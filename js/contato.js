const form=document.getElementById("contactForm");
const status=document.getElementById("contactStatus");
const submit=document.getElementById("submitContact");
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