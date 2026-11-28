/* Conclusão do convite Supabase: usuário define a própria senha. */
(() => {
 const client=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
 const form=document.getElementById("invitePasswordForm");
 const status=document.getElementById("invitePasswordStatus");
 const submit=document.getElementById("invitePasswordSave");
 const pw=document.getElementById("invitePassword");
 const confirmation=document.getElementById("invitePasswordConfirm");
 function say(text,error=false){status.textContent=text;status.classList.toggle("error",error)}
 async function init(){
  try{
   const {data:{user},error}=await client.auth.getUser();
   if(error||!user){
    say("Este convite expirou ou é inválido. Solicite um novo convite ao administrador.",true);
    return;
   }
   form.hidden=false;
   say("Convite verificado. Escolha uma senha para continuar.");
  }catch(error){say("Não foi possível verificar o convite: "+error.message,true)}
 }
 form.addEventListener("submit",async event=>{
  event.preventDefault();
  if(submit.disabled)return;
  if(pw.value!==confirmation.value){say("As senhas digitadas não coincidem.",true);return;}
  if(pw.value.length<10){say("Escolha uma senha de pelo menos 10 caracteres.",true);return;}
  submit.disabled=true;say("Salvando senha...");
  try{
   const {error}=await client.auth.updateUser({password:pw.value});
   if(error)throw error;
   const {data:{user}}=await client.auth.getUser();
   const {data:profile,error:profileError}=await client.from("profiles").select("role,active").eq("id",user.id).maybeSingle();
   if(profileError||!profile||profile.active===false)throw new Error("Sua conta está inativa ou não possui perfil.");
   say("Senha cadastrada! Abrindo seu painel...");
   window.location.assign(profile.role==="admin"?"admin.html":"aluno.html");
  }catch(error){say("Erro ao salvar: "+error.message,true);submit.disabled=false;}
 });
 init();
})();
