/* Fórum de discussão por aula: publicado imediatamente, com respostas e moderação. */
async function initLessonDiscussion(lessonId) {
  const section = document.getElementById("lessonDiscussion");
  if (!section) return;
  const status = section.querySelector("#discussionStatus");
  const list = section.querySelector("#discussionList");
  const counter = section.querySelector("#discussionCount");
  const form = section.querySelector("#discussionForm");
  const textarea = section.querySelector("#discussionMessage");
  const send = section.querySelector("#discussionSend");
  const replyInfo = section.querySelector("#discussionReplyInfo");
  const cancelReply = section.querySelector("#discussionCancelReply");
  let replyTo = null;
  let canModerate = false;
  let currentUserId = null;

  try {
    const {data:{user}}=await sb2.auth.getUser();
    if(user){
      currentUserId=user.id;
      const {data:profile}=await sb2.from("profiles").select("role").eq("id",user.id).maybeSingle();
      canModerate=profile?.role==="admin";
    }
  } catch (error) { console.warn("Não foi possível verificar a função do usuário.",error); }

  const dateLabel = value => new Date(value).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"});
  function setStatus(text,isError=false) {
    status.textContent = text;
    status.classList.toggle("is-error",isError);
  }
  function setReply(message) {
    replyTo = message;
    replyInfo.hidden = !message;
    if (message) {
      replyInfo.querySelector("span").textContent = "Respondendo a " + message.author_name;
      textarea.focus();
    }
  }
  cancelReply?.addEventListener("click",()=>setReply(null));

  async function load() {
    const {data,error} = await sb2.from("lesson_discussions")
      .select("id,lesson_id,user_id,parent_id,message,author_name,author_is_admin,created_at")
      .eq("lesson_id",lessonId).order("created_at",{ascending:true}).limit(250);
    if (error) {
      setStatus("Não foi possível carregar as discussões: " + error.message,true);
      return;
    }
    const items=data||[];
    counter.textContent=items.length === 1 ? "1 mensagem" : items.length+" mensagens";
    list.replaceChildren();
    if (!items.length) {
      const empty=document.createElement("p");
      empty.className="legion-discussion-empty";
      empty.textContent="Nenhuma mensagem ainda. Seja o primeiro a participar da discussão!";
      list.appendChild(empty);
      return;
    }

    function addMessage(item,isReply=false) {
      const card=document.createElement("article");
      card.className="legion-discussion-message"+(isReply?" is-reply":"");
      const avatar=document.createElement("div");
      avatar.className="legion-discussion-avatar";
      avatar.textContent=(item.author_name||"A").charAt(0).toUpperCase();
      const body=document.createElement("div");
      body.className="legion-discussion-message-content";
      const header=document.createElement("div");
      header.className="legion-discussion-message-head";
      const author=document.createElement("strong");
      author.textContent=item.author_name||"Aluno";
      header.append(author);
      if(item.author_is_admin){
        const badge=document.createElement("span");
        badge.className="legion-discussion-admin-badge";
        badge.textContent="Administrador";
        header.append(badge);
      }
      const date=document.createElement("time");
      date.textContent=dateLabel(item.created_at);
      header.append(date);
      const message=document.createElement("p");
      message.className="legion-discussion-message-text";
      message.textContent=item.message;
      const actions=document.createElement("div");
      actions.className="legion-discussion-actions";
      if(!isReply) {
        const reply=document.createElement("button");
        reply.type="button";
        reply.textContent="↳ Responder";
        reply.addEventListener("click",()=>setReply(item));
        actions.append(reply);
      }
      if(canModerate){
        const remove=document.createElement("button");
        remove.type="button";
        remove.className="is-delete";
        remove.textContent="Excluir";
        remove.addEventListener("click",async()=>{
          if(!confirm("Excluir esta mensagem"+(isReply?"":" e suas respostas")+"?"))return;
          remove.disabled=true;
          const {error} = await sb2.from("lesson_discussions").delete().eq("id",item.id);
          if(error){setStatus("Não foi possível excluir: "+error.message,true);remove.disabled=false;return;}
          setStatus("Mensagem excluída.");
          await load();
        });
        actions.append(remove);
      }
      body.append(header,message,actions);
      card.append(avatar,body);
      if(isReply)return card;
      list.append(card);
      const responses=items.filter(m=>m.parent_id===item.id);
      if(responses.length){
        const replies=document.createElement("div");
        replies.className="legion-discussion-replies";
        for(const response of responses)replies.append(addMessage(response,true));
        list.append(replies);
      }
      return card;
    }
    items.filter(item=>!item.parent_id).forEach(item=>addMessage(item));
  }

  form.addEventListener("submit",async(event)=>{
    event.preventDefault();
    if(send.disabled)return;
    const message=textarea.value.trim();
    if(message.length<3 || message.length>2000){
      setStatus("Digite uma mensagem entre 3 e 2.000 caracteres.",true);
      return;
    }
    send.disabled=true;
    setStatus("Publicando...");
    const {error}=await sb2.from("lesson_discussions").insert({
      lesson_id:lessonId,parent_id:replyTo?.id||null,message
    });
    send.disabled=false;
    if(error){setStatus("Não foi possível publicar: "+error.message,true);return;}
    textarea.value="";
    setReply(null);
    setStatus("Comentário publicado!");
    await load();
  });
  await load();
}
