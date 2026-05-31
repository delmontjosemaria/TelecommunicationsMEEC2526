/*
 * RM - segundo trabalho
 *
 *      IMS Service
 *
 *  Rodolfo Oliveira
 *   rado@fct.unl.pt
 *
 */
package org.mobicents.servlet.sip.example;

import java.util.Date;


/**
 * 
 * CreditControl.java
 *
 * 
 */
public class CreditControl {

  private String user;    // identifies the user
  private Date date_off;  // date when a given user is unregistered

  String callID;

  private float credit;  // ammount of credit
  private boolean is_registered; // controls if user is registered

  
  public CreditControl(String user, Date date){
    this.is_registered = true;
    this.credit = 500;
    this.user = user;
    this.date_off = date;//new SimpleDateFormat("dd/MM/yyyy 'at' HH:mm:ss").format(date);

   // DiameterOpenIMSSipServlet.sendSIPMessage("#", "ss#");

  }


  
  public String getNotification(){
    return "Dear " + this.user + ", your credit is " + this.credit + ".\nThank you,\nDelcom";

  }
  
  @Override
  public int hashCode(){
    //return (callee + date).hashCode();
      return (user).hashCode();
  }
  
  @Override
  public boolean equals(Object obj){
    if(obj != null && obj instanceof CreditControl){
      CreditControl other = (CreditControl)obj;
      //return this.callee.equals(other.callee) && this.date.equals(other.date);
      return this.user.equals(other.user);
    }
    return false;
  }

public float getCredit(){
    return credit;
  }

public float subCredit(float value){
    credit = credit-value;
    return credit;
  }

public String getUser(){
  return this.user;
}


// update credit when the user does the DEregister
public void setDate_off(Date d){
  this.date_off = d;
  this.is_registered = false;
}

// update credit when the user does the register
public void update_register(){
  if (!this.is_registered){
    Date now = new Date();
    // difference in miliseconds
    long diff = now.getTime() - date_off.getTime();
    long timeLeft = (long)Math.ceil(diff/60000);//arredonda por cima, x.y minutos na verdade sao x+1 minutos.
    float finalPrice = 0;
    int i = 1;
    while(timeLeft > 0){
        finalPrice+=Math.min(60, timeLeft)*i;
        timeLeft-=60;
        i++;
    }
    this.subCredit(finalPrice);
    this.is_registered = true;
  }
}



}//class

