package org.mobicents.servlet.sip.example;

import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

public class TimerManager {
    private static final ScheduledExecutorService scheduler =
        Executors.newScheduledThreadPool(10);

    public static final int TAX_MINUTES = 2;
    public static final int CALLER_FEE_PER_MINUTE = 30;
    public static final int CALLEE_FEE_PER_MINUTE = 20;
    public static final int CALLER_BLOCK = TAX_MINUTES * CALLER_FEE_PER_MINUTE; // 60
    public static final int CALLEE_BLOCK = TAX_MINUTES * CALLEE_FEE_PER_MINUTE; // 40

    private final String callId;
    private final CreditControl callerCC;
    private final CreditControl calleeCC;   // pode ser null se callee externo
    private final String callerURI;
    private final String calleeURI;         // para eventRegister

    private ScheduledFuture<?> timer;
    private volatile boolean active;        // volatile: lido por threads diferentes
    private long startTimeMs;

    public TimerManager(String callId,
                        CreditControl callerCC, String callerURI,
                        CreditControl calleeCC, String calleeURI) {
        this.callId  = callId;
        this.callerCC = callerCC;
        this.callerURI = callerURI;
        this.calleeCC = calleeCC;
        this.calleeURI = calleeURI;
        this.active = false;
    }

    public void startTimer() {
        if (active) return;
        active = true;
        scheduleNext();
    }

    private void scheduleNext() {
        // startTimeMs regista o início do bloco atual (para restituição no BYE)
        startTimeMs = System.currentTimeMillis();
        timer = scheduler.schedule(this::onTimerExpired, TAX_MINUTES, TimeUnit.MINUTES);
    }

    private void onTimerExpired() {
        // Garantia: se o BYE chegou entretanto e fez active=false, não cobra nem renova
        if (!active) return;

        // Cobrar bloco ao caller (sempre)
        callerCC.subCredit(CALLER_BLOCK);
        DiameterOpenIMSSipServlet.instance.eventRegister(
            callerURI, DiameterOpenIMSSipServlet.SESSION_CALLER_MSG,
            (int) callerCC.getCredit());

        // Cobrar bloco ao callee (objetivo 3) — só se existir no sistema
        if (calleeCC != null) {
            calleeCC.subCredit(CALLEE_BLOCK);
            DiameterOpenIMSSipServlet.instance.eventRegister(
                calleeURI, DiameterOpenIMSSipServlet.SESSION_CALLEE_MSG,
                (int) calleeCC.getCredit());
        }

        DiameterOpenIMSSipServlet.logger.info(
            "==============> RM T2 logger: Timer block expired for call [" + callId +
            "] — caller balance: " + callerCC.getCredit() +
            ", callee balance: " + (calleeCC != null ? calleeCC.getCredit() : "N/A"));

        // SMS ao caller se saldo negativo após cobrança
        if (callerCC.getCredit() < 0) {
            DiameterOpenIMSSipServlet.sendSIPMessage(callerURI,
                "Dear User,\nYour balance is negative (" + callerCC.getCredit() +
                " credits).\nPlease consider ending the call.");
        }

        // Renovar automaticamente para o próximo bloco de 2 minutos
        scheduleNext();
    }

    /**
     * Chamado no BYE. Cancela o timer e restitui créditos não consumidos
     * do bloco atual, baseado no tempo decorrido desde scheduleNext().
     *
     * Regra do enunciado:
     *   elapsed < 10s  → restituir bloco inteiro (60 caller + 40 callee)
     *   10s–80s        → restituir metade (30 caller + 20 callee)
     *   > 80s          → sem restituição
     */
    public void stopAndRefund() {
        if (!active) return;
        active = false; // impede onTimerExpired() de correr mesmo se já agendado

        if (timer != null) timer.cancel(false);

        long elapsedSec = (System.currentTimeMillis() - startTimeMs) / 1000;

        int callerRefund = 0;
        int calleeRefund = 0;

        if (elapsedSec < 10) {
            callerRefund = CALLER_BLOCK;            // 60
            calleeRefund = CALLEE_BLOCK;            // 40
        } else if (elapsedSec < 80) {
            callerRefund = CALLER_FEE_PER_MINUTE;   // 30
            calleeRefund = CALLEE_FEE_PER_MINUTE;   // 20
        }

        if (callerRefund > 0) {
            callerCC.subCredit(-callerRefund);
            DiameterOpenIMSSipServlet.instance.eventRegister(
                callerURI, DiameterOpenIMSSipServlet.SESSION_ENDED_MSG,
                (int) callerCC.getCredit());
        }

        if (calleeRefund > 0 && calleeCC != null) {
            calleeCC.subCredit(-calleeRefund);
            DiameterOpenIMSSipServlet.instance.eventRegister(
                calleeURI, DiameterOpenIMSSipServlet.SESSION_ENDED_MSG,
                (int) calleeCC.getCredit());
        }

        DiameterOpenIMSSipServlet.logger.info(
            "==============> RM T2 logger: Timer stopped for [" + callId +
            "] elapsed=" + elapsedSec + "s" +
            ", callerRefund=" + callerRefund +
            ", calleeRefund=" + calleeRefund);
    }

    public boolean isActive() { return active; }
}