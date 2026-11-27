const form=document.getElementById("contactForm");
const status=document.getElementById("contactStatus");
const submit=document.getElementById("submitContact");
// Preenche o assunto quando o aluno solicita a oferta de consultoria.
const contactTopic = new URLSearchParams(location.search).get("assunto");
if (contactTopic === "Consultoria pelo Telegram") {
  const topicField = form.elements.namedItem("subject");
  if (topicField) topicField.value = contactTopic;
  const messageField = form.elements.namedItem("message");
  if (messageField && !messageField.value) {
    messageField.value = "Olá! Já sou aluno da Legion Academy e gostaria de adquirir a consultoria vitalícia pelo Telegram. Como faço para realizar a compra?";
    // O valor da oferta é obtido do banco, nunca de uma cifra fixa no código.
    const pricingClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
    pricingClient.from("telegram_pricing").select("later_price_cents").eq("id",1).single().then(({data,error})=>{
      const cents=data?.later_price_cents;
      if(error||!Number.isSafeInteger(cents)||cents<=0)return;
      const formatted=(cents/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
      // Não substitui texto que o aluno já começou a editar.
      const current=messageField.value;
      if(current==="Olá! Já sou aluno da Legion Academy e gostaria de adquirir a consultoria vitalícia pelo Telegram. Como faço para realizar a compra?"){
        messageField.value="Olá! Já sou aluno da Legion Academy e gostaria de adquirir a consultoria vitalícia pelo Telegram por "+formatted+". Como faço para realizar a compra?";
      }
    }).catch(error=>console.warn("Preço do Telegram indisponível",error));
  }
}

form.addEventListener("submit",async(event)=>{
 event.preventDefault();
 if(!form.reportValidity())return;
 submit.disabled=true;
 submit.textContent="Enviando...";
 status.textContent="";
 status.className="";
 try{
  const payload={
    name:form.elements.namedItem("name").value.trim(),
    email:form.elements.namedItem("email").value.trim(),
    subject:form.elements.namedItem("subject").value,
    message:form.elements.namedItem("message").value.trim(),
    website:form.elements.namedItem("website").value
  };
  const response=await fetch(SUPABASE_URL+"/functions/v1/contact-submit",{
   method:"POST",
   headers:{"Content-Type":"application/json","apikey":SUPABASE_ANON_KEY},
   body:JSON.stringify(payload)
  });
  const result=await response.json().catch(()=>({}));
  if(!response.ok||!result.ok)throw new Error(result.error||"Não foi possível registrar sua mensagem.");
  form.reset();
  status.className="ok";
  status.textContent="Mensagem registrada com sucesso! Nossa equipe poderá consultar sua solicitação.";
 }catch(error){
  status.className="error";
  status.textContent=(error.message||"Falha ao enviar a mensagem.")+" Se preferir, escreva para systemsnfs@gmail.com.";
 }finally{
  submit.disabled=false;submit.textContent="Enviar mensagem ➜";
 }
});