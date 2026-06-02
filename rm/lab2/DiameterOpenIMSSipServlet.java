package org.mobicents.servlet.sip.example;
 
import java.io.BufferedWriter;
import java.io.FileWriter;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.concurrent.ConcurrentHashMap;
 
import javax.servlet.ServletConfig;
import javax.servlet.ServletException;
import javax.servlet.sip.Address;
import javax.servlet.sip.Proxy;
import javax.servlet.sip.SipApplicationSession;
import javax.servlet.sip.SipFactory;
import javax.servlet.sip.SipServlet;
import javax.servlet.sip.SipServletRequest;
import javax.servlet.sip.SipServletResponse;
 
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
 
/**
 * DiameterOpenIMSSipServlet.java
 *
 * RM 2025/2026 — Trabalho 2 — IMS Service
 * Alunos: Delmont Maria (75218), Francisco Guerreiro (65505)
 */
public class DiameterOpenIMSSipServlet extends SipServlet {
 
    private static final long serialVersionUID = 1L;
 
    public static Logger logger = LoggerFactory.getLogger(DiameterOpenIMSSipServlet.class);
 
    // Instância estática necessária para o TimerManager chamar eventRegister()
    public static DiameterOpenIMSSipServlet instance;
 
    DiameterShClient diameterShClient = null;
 
    private static SipFactory sipFactory;
 
    // Mapa de crédito por utilizador (ConcurrentHashMap — thread-safe)
    public static ConcurrentHashMap<String, CreditControl> usersCreditDB =
        new ConcurrentHashMap<>();
 
    // Mapa de timers activos por callId — robusto em modo proxy:
    // garante que doBye encontra sempre o timer certo, independentemente
    // da sessão SIP em que o pedido chega
    public static ConcurrentHashMap<String, TimerManager> activeTimers =
        new ConcurrentHashMap<>();
 
    // Constantes de taxação
    public static final int    SESSION_INIT_FEE      = 50;
    public static final int    SESSION_CALLER_FEE     = 30;
    public static final int    SESSION_CALLEE_FEE     = 20;
    public static final int    TAX_TIME_MINUTES       = 2;
    public static final int    TOTAL_INIT_FEE         =
        SESSION_INIT_FEE + TAX_TIME_MINUTES * SESSION_CALLER_FEE; // 110
 
    // Constantes de mensagens para eventRegister
    public static final String USER_UNREGISTER_MSG    = "USER_UNREGISTER";
    public static final String USER_REREGISTER_MSG    = "USER_REREGISTER";
    public static final String SESSION_INIT_FEE_MSG   = "SESSION_INIT_FEE";
    public static final String SESSION_CALLER_MSG     = "CALLER_FEE";
    public static final String SESSION_CALLEE_MSG     = "CALLEE_FEE";
    public static final String SESSION_ENDED_MSG      = "SESSION_ENDED";
    public static final String LOW_CREDIT_MSG         =
        "Dear User,\nYour credit does not allow you to make this call.\n" +
        "Please, consider charging your device.";
 
    // -------------------------------------------------------------------------
 
    public DiameterOpenIMSSipServlet() {}
 
    @Override
    public void init(ServletConfig servletConfig) throws ServletException {
 
        logger.info("==============================================================================");
        logger.info("==============>                                              =================");
        logger.info("==============>    RM  2025/2026                             =================");
        logger.info("==============>         Trab 2 IMS Service - FCT             =================");
        logger.info("==============>                                              =================");
        logger.info("==============>   Students:                                  =================");
        logger.info("==============>         Delmont Maria, 75218                 =================");
        logger.info("==============>         Francisco Guerreiro, 65505           =================");
        logger.info("==============>                                              =================");
        logger.info("==============================================================================");
 
        // Guardar instância para uso pelo TimerManager
        instance = this;
 
        super.init(servletConfig);
 
        // Obter SIP Factory
        sipFactory = (SipFactory) servletConfig.getServletContext()
            .getAttribute(SIP_FACTORY);
 
        // Inicializar cliente Diameter Sh
        try {
            this.diameterShClient = new DiameterShClient();
            logger.info("==============> RM T2 logger: Sh-Client initialized successfully.");
        } catch (Exception e) {
            logger.error("==============> RM T2 logger: Sh-Client failed to initialize.", e);
        }
    }
 
    // -------------------------------------------------------------------------
    // doInvite — reserva de crédito inicial
    // -------------------------------------------------------------------------
 
    @Override
    protected void doInvite(SipServletRequest request)
            throws ServletException, IOException {
        String fromURI = request.getFrom().getURI().toString();
        String toURI   = request.getTo().getURI().toString();
        try {
            logger.info("==============> RM T2 logger: Processing INVITE ("
                + request.getFrom() + " -> " + request.getTo() + ")");
 
            if (request.isInitial()) {
                Proxy proxy = request.getProxy();
 
                if (request.getSession().getAttribute("firstInvite") == null) {
                    CreditControl ccCaller = usersCreditDB.get(fromURI);
                    CreditControl ccCallee = usersCreditDB.get(toURI);
 
                    // Objetivo 2c: rejeitar se crédito insuficiente
                    if (ccCaller == null || ccCaller.getCredit() < TOTAL_INIT_FEE) {
                        SipServletResponse ans = request.createResponse(402);
                        ans.send();
                        sendSIPMessage(request.getFrom().toString(), LOW_CREDIT_MSG);
                        return;
                    }
 
                    // Aviso se callee não está no sistema (não bloqueia a chamada)
                    if (ccCallee == null) {
                        logger.warn("==============> RM T2 logger: Callee [" + toURI +
                            "] not found in usersCreditDB — callee will not be charged.");
                    }
 
                    // Reservar 110 créditos ao caller (50 fixos + 60 de 2 min)
                    ccCaller.subCredit(TOTAL_INIT_FEE);
                    eventRegister(fromURI, SESSION_INIT_FEE_MSG, (int) ccCaller.getCredit());
 
                    request.getSession().setAttribute("firstInvite", true);
 
                    // Guardar URIs na sessão para uso no doAck
                    request.getSession().setAttribute("callerURI", fromURI);
                    request.getSession().setAttribute("calleeURI", toURI);
 
                    proxy.setRecordRoute(true);
                    proxy.setSupervised(true);
                }
                proxy.proxyTo(request.getRequestURI());
            }
        } catch (Exception e) {
            logger.error("==============> RM T2 logger: Failure in doInvite.", e);
        }
    }
 
    // -------------------------------------------------------------------------
    // doAck — arranque do timer (sessão efectivamente estabelecida)
    // -------------------------------------------------------------------------
 
    @Override
    protected void doAck(SipServletRequest request)
            throws ServletException, IOException {
        try {
            logger.info("==============> RM T2 logger: Processing ACK ("
                + request.getFrom() + " -> " + request.getTo() + ")");
 
            // Recuperar URIs guardados no doInvite (robustez em modo proxy)
            String callerURI = (String) request.getSession().getAttribute("callerURI");
            String calleeURI = (String) request.getSession().getAttribute("calleeURI");
 
            // Fallback se os atributos da sessão não estiverem disponíveis
            if (callerURI == null) callerURI = request.getFrom().getURI().toString();
            if (calleeURI == null) calleeURI = request.getTo().getURI().toString();
 
            CreditControl ccCaller = usersCreditDB.get(callerURI);
            CreditControl ccCallee = usersCreditDB.get(calleeURI); // pode ser null
 
            if (ccCaller == null) {
                logger.error("==============> RM T2 logger: Caller [" + callerURI +
                    "] not found in doAck — timer not started.");
                return;
            }
 
            // Criar timer com caller e callee (ccCallee pode ser null — tratado no TimerManager)
            TimerManager tm = new TimerManager(
                request.getCallId(),
                ccCaller, callerURI,
                ccCallee, calleeURI);
 
            // Arrancar timer — objetivo 2: timer activo a partir do ACK
            tm.startTimer();
 
            // Guardar no mapa estático por callId em vez de na sessão SIP —
            // garante que doBye encontra o timer mesmo em sessão servlet diferente
            activeTimers.put(request.getCallId(), tm);
 
            // Registar início de sessão no ficheiro
            eventRegister(callerURI, SESSION_CALLER_MSG, (int) ccCaller.getCredit());
            if (ccCallee != null) {
                eventRegister(calleeURI, SESSION_CALLEE_MSG, (int) ccCallee.getCredit());
            }
 
        } catch (Exception e) {
            logger.error("==============> RM T2 logger: Failure in doAck.", e);
        }
    }
 
    // -------------------------------------------------------------------------
    // doBye — cancelar timer, restituição e SMS final
    // -------------------------------------------------------------------------
 
    @Override
    protected void doBye(SipServletRequest request)
            throws ServletException, IOException {
        try {
            logger.info("==============> RM T2 logger: Processing BYE ("
                + request.getFrom() + " -> " + request.getTo() + ")");
 
            String callId    = request.getCallId();
            String callerURI = request.getFrom().getURI().toString();
 
            // Recuperar timer pelo callId — robusto em modo proxy
            TimerManager tm = activeTimers.remove(callId);
 
            if (tm != null && tm.isActive()) {
                // stopAndRefund() cancela o timer, restitui créditos não consumidos
                // e chama eventRegister internamente para caller e callee
                tm.stopAndRefund();
            } else {
                logger.warn("==============> RM T2 logger: No active timer found for callId ["
                    + callId + "] in doBye.");
            }
 
            // SMS ao caller com saldo final
            CreditControl ccCaller = usersCreditDB.get(callerURI);
            if (ccCaller != null) {
                sendSIPMessage(request.getFrom().toString(),
                    "Dear User,\nYour call has ended.\n" +
                    "Remaining balance: " + ccCaller.getCredit() + " credits.");
            }
 
        } catch (Exception e) {
            logger.error("==============> RM T2 logger: Failure in doBye.", e);
        }
    }
 
    // -------------------------------------------------------------------------
    // doSuccessResponse — confirmação ao caller após 200 OK
    // -------------------------------------------------------------------------
 
    @Override
    protected void doSuccessResponse(SipServletResponse response)
            throws ServletException, IOException {
        try {
            // Só nos interessa o 200 OK ao INVITE
            if (response.getStatus() != 200
                    || !response.getRequest().getMethod().equals("INVITE")) return;
 
            String fromURI = response.getFrom().getURI().toString();
            CreditControl ccCaller = usersCreditDB.get(fromURI);
 
            logger.info("==============> RM T2 logger: 200 OK for INVITE from ["
                + fromURI + "] — session established.");
 
            // Notificar o caller que a sessão foi estabelecida com sucesso
            if (ccCaller != null) {
                sendSIPMessage(response.getFrom().toString(),
                    "Dear User,\nYour call was connected successfully.\n" +
                    "Current balance: " + ccCaller.getCredit() + " credits.");
            }
 
        } catch (Exception e) {
            logger.error("==============> RM T2 logger: Failure in doSuccessResponse.", e);
        }
    }
 
    // -------------------------------------------------------------------------
    // doErrorResponse — restituição de reserva em caso de erro no INVITE
    // -------------------------------------------------------------------------
 
    @Override
    protected void doErrorResponse(SipServletResponse response)
            throws ServletException, IOException {
        String fromURI = response.getFrom().getURI().toString();
        try {
            logger.info("==============> RM T2 logger: Processing Error Response ("
                + response.getStatus() + ")");
 
            // Só restituir reserva se o erro é relativo a um INVITE
            // (nota: "INVITE" em maiúsculas — correcção do bug original)
            if (response.getRequest().getMethod().equals("INVITE")) {
                CreditControl cc = usersCreditDB.get(fromURI);
                if (cc != null) {
                    cc.subCredit(-TOTAL_INIT_FEE); // restituir os 110 reservados
                    eventRegister(fromURI, SESSION_ENDED_MSG, (int) cc.getCredit());
                    logger.info("==============> RM T2 logger: Refunded " + TOTAL_INIT_FEE
                        + " credits to [" + fromURI + "] — new balance: " + cc.getCredit());
                }
            }
 
            switch (response.getStatus()) {
                case 404:
                    logger.info("==============> RM T2 logger: User not found (404).");
                    break;
                case 603:
                    logger.info("==============> RM T2 logger: INVITE declined (603).");
                    break;
                default:
                    logger.info("==============> RM T2 logger: Error response ("
                        + response.getStatus() + ") — not processing further.");
            }
 
        } catch (Exception e) {
            logger.error("==============> RM T2 logger: Failure in doErrorResponse.", e);
        }
    }
 
    // -------------------------------------------------------------------------
    // eventRegister — registo de eventos em ficheiro .txt por utilizador
    // -------------------------------------------------------------------------
 
    public void eventRegister(String secretID, String eventType, int credit) {
        Calendar calendar = Calendar.getInstance();
        Date actualDate   = calendar.getTime();
        SimpleDateFormat formatter = new SimpleDateFormat("dd/MM/yyyy HH:mm:ss");
 
        String filename = secretID + ".txt";
        String line = String.format("%s | %s | Credit: %d",
            formatter.format(actualDate), eventType, credit);
 
        BufferedWriter writer = null;
        try {
            writer = new BufferedWriter(new FileWriter(filename, true));
            writer.write(line);
            writer.newLine();
        } catch (IOException ioe) {
            logger.error("==============> RM T2 logger: Error writing event file: "
                + ioe.getMessage());
        } finally {
            if (writer != null) {
                try { writer.close(); } catch (IOException e) { /* ignorar */ }
            }
        }
    }
 
    // -------------------------------------------------------------------------
    // sendSIPMessage — envio de mensagem SIP ao utilizador
    // -------------------------------------------------------------------------
 
    public static void sendSIPMessage(String toAddressString, String message) {
        try {
            logger.info("==============> RM T2 logger: Sending SIP Message to ["
                + toAddressString + "]");
 
            SipApplicationSession appSession = sipFactory.createApplicationSession();
            Address from = sipFactory.createAddress("RM_T2 <sip:rm_t2@open-ims.test>");
            Address to   = sipFactory.createAddress(toAddressString);
            SipServletRequest request = sipFactory.createRequest(appSession, "MESSAGE", from, to);
            request.setContent(message, "text/html");
            request.send();
 
        } catch (Exception e) {
            logger.error("==============> RM T2 logger: Failure sending SIP Message.", e);
        }
    }
}