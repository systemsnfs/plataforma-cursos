const forumClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
const forumList=document.getElementById("forumAdminList");
const forumStatus=document.getElementById("forumAdminStatus");
const forumCount=document.getElementById("forumCount");
const forumFilter=document.getElementById("forumLessonFilter");
let forumLessonNames=new Map();
let forumMessages=[];
const escForum=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
async function forumAdminInit(){
 const {data:{user}}=await forumClient.auth.getUser();
 if(!user){location.href="login.html";return;}
 const {data:profile,error}=await forumClient.from("profiles").select("role,active").eq("id",user.id).maybeSingle();
 if(error||profile?.role!=="admin"||profile?.active===false){
  document.querySelector("main").innerHTML="<h1>Acesso negado</h1><p>Esta área é exclusiva do administrador.</p>";return;
 }
 await loadForumAdmin();
}
async function loadForumAdmin(){
 forumStatus.textContent="";
 const [messagesResult,lessonsResult]=await Promise.all([
  forumClient.from("lesson_discussions").select("id,lesson_id,user_id,parent_id,author_name,author_is_admin,message,created_at").order("created_at",{ascending:false}).limit(300),
  forumClient.from("lessons").select("id,title").order("title")
 ]);
 if(messagesResult.error||lessonsResult.error){forumStatus.textContent="Não foi possível carregar o fórum: "+(messagesResult.error||lessonsResult.error).message;return;}
 forumMessages=messagesResult.data||[];
 forumLessonNames=new Map((lessonsResult.data||[]).map(l=>[l.id,l.title]));
 const old=forumFilter.value;
 forumFilter.innerHTML='<option value="">Todas as aulas</option>'+
 [...forumLessonNames.entries()].map(([id,title])=>'<option value="'+escForum(id)+'">'+escForum(title)+'</option>').join("");
 if(forumLessonNames.has(old))forumFilter.value=old;
 renderForumAdmin();
}
function renderForumAdmin(){
 const data=forumMessages.filter(m=>!forumFilter.value||m.lesson_id===forumFilter.value);
 forumCount.textContent=data.length+" mensagem(ns)"+(forumMessages.length===300?" (300 mais recentes)":"");
 forumList.innerHTML=data.length?data.map(m=>`
 <article class="forum-admin-card">
 <div class="forum-admin-meta"><span>${escForum(m.author_name)}</span><span>·</span><span>${escForum(new Date(m.created_at).toLocaleString("pt-BR"))}</span><span>·</span><span>${m.parent_id?"Resposta":"Comentário"}</span>${m.author_is_admin?" · Administrador":""}</div>
 <h2>${escForum(forumLessonNames.get(m.lesson_id)||"Aula indisponível")}</h2>
 <p>${escForum(m.message)}</p>
 <div class="forum-admin-actions">
 <a href="aula.html?id=${encodeURIComponent(m.lesson_id)}" target="_blank" rel="noopener noreferrer">Ver aula ↗</a>
 <button type="button" data-id="${escForum(m.id)}" class="forumRemove">Excluir mensagem</button>
 </div></article>`).join(""):'<div class="forum-admin-empty">Nenhuma mensagem encontrada.</div>';
 forumList.querySelectorAll(".forumRemove").forEach(button=>button.addEventListener("click",async()=>{
  if(!confirm("Excluir esta mensagem? As respostas vinculadas também serão excluídas."))return;
  button.disabled=true;
  const {error}=await forumClient.from("lesson_discussions").delete().eq("id",button.dataset.id);
  if(error){forumStatus.textContent="Erro ao excluir: "+error.message;button.disabled=false;return;}
  forumStatus.textContent="";
  await loadForumAdmin();
 }));
}
forumFilter.addEventListener("change",renderForumAdmin);
document.getElementById("forumRefresh").addEventListener("click",loadForumAdmin);
document.getElementById("forumLogout").addEventListener("click",async()=>{await forumClient.auth.signOut();location.href="index.html";});
forumAdminInit();