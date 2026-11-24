const client=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
const list=document.getElementById("contactMessages"),status=document.getElementById("contactAdminStatus");
function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[ch]));}
async function init(){
 const {data:{user},error}=await client.auth.getUser();
 if(error||!user){location.href="login.html";return;}
 const {data:profile,error:profileError}=await client.from("profiles").select("role").eq("id",user.id).maybeSingle();
 if(profileError||profile?.role!=="admin"){document.querySelector("main").innerHTML="<h1>Acesso negado</h1><p>Esta página é exclusiva para administradores.</p>";return;}
 await loadMessages();
}
async function loadMessages(){
 const {data,error}=await client.from("contact_messages").select("id,created_at,name,email,subject,message,status").order("created_at",{ascending:false}).limit(200);
 if(error){status.textContent="Erro ao carregar mensagens: "+error.message;return;}
 const messages=data||[];
 document.getElementById("totalMessages").textContent=messages.length+" mensagem(ns)"+(messages.length===200?" (200 mais recentes)":"");
 if(!messages.length){list.innerHTML='<div class="legion-inbox-empty">Nenhuma mensagem recebida até o momento.</div>';return;}
 list.innerHTML=messages.map(m=>`
 <article class="legion-inbox-card">
 <div class="legion-inbox-top"><div><div class="legion-inbox-meta">${escapeHtml(m.name)} · ${escapeHtml(m.email)} · ${escapeHtml(new Date(m.created_at).toLocaleString("pt-BR"))}</div><h2>${escapeHtml(m.subject)}</h2></div><span class="legion-inbox-badge ${m.status==="new"?"new":""}">${m.status==="new"?"Nova":"Lida"}</span></div>
 <p>${escapeHtml(m.message)}</p>
 <div class="legion-inbox-actions"><a href="mailto:${encodeURIComponent(m.email)}?subject=${encodeURIComponent("Re: "+m.subject)}">Responder por e-mail</a>${m.status==="new"?`<button type="button" class="markRead" data-id="${m.id}">Marcar como lida</button>`:""}</div>
 </article>`).join("");
 list.querySelectorAll(".markRead").forEach(b=>b.addEventListener("click",async()=>{
  b.disabled=true;
  const {error}=await client.from("contact_messages").update({status:"read"}).eq("id",b.dataset.id);
  if(error){status.textContent=error.message;b.disabled=false;return;}
  status.textContent="";await loadMessages();
 }));
}
document.getElementById("logout").addEventListener("click",async()=>{await client.auth.signOut();location.href="index.html";});
init();