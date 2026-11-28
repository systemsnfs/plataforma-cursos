/* Administração de contas — operações privilegiadas somente na Edge Function. */
(() => {
 const section=document.getElementById("adminUsersSection");
 if(!section)return;
 const client=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
 const form=document.getElementById("adminInviteForm");
 const submit=document.getElementById("adminInviteSubmit");
 const list=document.getElementById("adminUsersList");
 const status=document.getElementById("adminUsersStatus");
 const refresh=document.getElementById("adminUsersRefresh");
 let selfId=null,busy=false;
 function show(text,error=false){status.textContent=text;status.classList.toggle("error",error)}
 function escape(value){return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[ch]));}
 function toggleBusy(value){busy=value;submit.disabled=value;refresh.disabled=value;}
 async function request(payload){
   const {data:{session},error:sessionError}=await client.auth.getSession();
   if(sessionError||!session?.access_token)throw new Error("Sua sessão expirou. Faça login novamente.");
   const response=await fetch(SUPABASE_URL+"/functions/v1/admin-users",{
     method:"POST",
     headers:{"apikey":SUPABASE_ANON_KEY,"Authorization":"Bearer "+session.access_token,"Content-Type":"application/json"},
     body:JSON.stringify(payload)
   });
   let data={};try{data=await response.json()}catch{}
   if(!response.ok)throw new Error(data.error||"Não foi possível completar a operação.");
   return data;
 }
 function render(items,partial){
   if(!items.length){list.innerHTML='<p class="legion-users-empty">Nenhum usuário encontrado.</p>';return;}
   list.innerHTML=items.map(u=>{
     const own=u.id===selfId;
     const isAdmin=u.role==="admin";
     const canChange=!own&&u.active;
     const text=own?"Sua conta":isAdmin?"Remover ADM":"Tornar ADM";
     return `<article class="legion-user-entry">
       <div class="legion-user-identity">
         <strong>${escape(u.full_name||"Sem nome")}</strong>
         <small>${escape(u.email||"E-mail indisponível")}</small>
       </div>
       <div class="legion-user-meta">
         <span class="legion-user-role ${isAdmin?"admin":""}">${isAdmin?"Administrador":"Aluno"}</span>
         ${!u.confirmed?'<span class="legion-user-role pending">E-mail pendente</span>':""}
         ${!u.active?'<span class="legion-user-role pending">Desativado</span>':""}
         <button type="button" class="legion-user-role-button ${isAdmin?"demote":""}" data-id="${escape(u.id)}" data-name="${escape(u.full_name||u.email||"usuário")}" data-role="${isAdmin?"student":"admin"}" ${canChange?"":"disabled"}>${text}</button>
       </div>
     </article>`;
   }).join("");
   for(const button of list.querySelectorAll(".legion-user-role-button")){
     button.addEventListener("click",async()=>{
       if(busy||button.disabled)return;
       const role=button.dataset.role,id=button.dataset.id;
       const name=button.dataset.name;
       const prompt=role==="admin"
         ?'Conceder acesso total ao painel ADM para "'+name+'"?'
         :'Remover o acesso de administrador de "'+name+'"?';
       if(!confirm(prompt))return;
       toggleBusy(true);button.disabled=true;show("Atualizando permissões...");
       try{
         const result=await request({action:"set-role",user_id:id,role});
         await load(result.message);
       }catch(error){show(error.message,true);button.disabled=false}
       finally{toggleBusy(false)}
     });
   }
   if(partial)show("A lista foi limitada aos 2.000 usuários mais recentes.");
 }
 async function load(message){
   show(message||"Carregando usuários...");
   try{
     const data=await request({action:"list"});
     render(data.users||[],data.partial);
     if(!data.partial)show(message||(data.users?.length||0)+" usuário(s) cadastrado(s).");
   }catch(error){show(error.message,true)}
 }
 async function init(){
   const {data:{user},error:authError}=await client.auth.getUser();
   if(authError||!user)return;
   const {data:profile,error:profileError}=await client.from("profiles").select("role,active").eq("id",user.id).maybeSingle();
   if(profileError||profile?.role!=="admin"||profile.active!==true)return;
   selfId=user.id;
   section.hidden=false;
   await load();
 }
 form.addEventListener("submit",async event=>{
   event.preventDefault();if(busy)return;
   const values=new FormData(form);
   const name=String(values.get("name")||"").trim();
   const email=String(values.get("email")||"").trim();
   const role=String(values.get("role")||"student");
   if(name.length<2||!email||!["student","admin"].includes(role)){show("Preencha os dados do usuário.",true);return}
   if(role==="admin"&&!confirm('Enviar convite concedendo acesso de ADMINISTRADOR para "'+email+'"?'))return;
   toggleBusy(true);show("Enviando convite...");
   try{
     const result=await request({action:"invite",name,email,role});
     form.reset();
     await load(result.message);
   }catch(error){show(error.message,true)}
   finally{toggleBusy(false)}
 });
 refresh.addEventListener("click",()=>{if(!busy)load()});
 init().catch(error=>show("Não foi possível carregar a área de usuários: "+error.message,true));
})();
