/* Reproduz o vídeo configurado pelo administrador, sem alterar o layout original. */
(() => {
  const playButton=document.getElementById("homeHeroPlay");
  const closeButton=document.getElementById("homeHeroClose");
  const player=document.getElementById("homeHeroVideo");
  const errorBox=document.getElementById("homeHeroVideoError");
  if(!playButton||!closeButton||!player)return;
  const client=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
  let videoUrl=null;

  function closeVideo(){
    player.pause();
    player.hidden=true;
    closeButton.hidden=true;
    player.removeAttribute("src");
    player.load();
    if(errorBox)errorBox.hidden=true;
    playButton.focus({preventScroll:true});
  }
  async function initHeroVideo(){
    try{
      const {data,error}=await client.from("homepage_media").select("video_path").eq("id",1).single();
      if(error)throw error;
      if(!data?.video_path)return;
      const path=data.video_path;
      if(!/^homepage\/[0-9a-f-]{36}\.(mp4|webm|mov)$/.test(path))return;
      videoUrl=client.storage.from("videos").getPublicUrl(path).data.publicUrl;
      playButton.disabled=false;
      playButton.setAttribute("aria-label","Reproduzir vídeo de apresentação da Legion Academy");
      playButton.title="Assistir ao vídeo de apresentação";
    }catch(error){console.warn("Não foi possível consultar o vídeo de apresentação:",error);}
  }
  playButton.addEventListener("click",async()=>{
    if(!videoUrl)return;
    if(errorBox)errorBox.hidden=true;
    player.src=videoUrl;
    player.hidden=false;
    closeButton.hidden=false;
    try{await player.play();}
    catch(error){
      // O player permanece acessível para o visitante tentar reproduzir manualmente.
      console.warn("Não foi possível iniciar reprodução automática após clique:",error);
      if(errorBox){
        errorBox.textContent="Toque no controle de reprodução do vídeo para assistir.";
        errorBox.hidden=false;
      }
    }
  });
  closeButton.addEventListener("click",closeVideo);
  player.addEventListener("ended",closeVideo);
  player.addEventListener("error",()=>{
    if(!player.hidden&&errorBox){
      errorBox.textContent="Não foi possível carregar o vídeo. Tente novamente mais tarde.";
      errorBox.hidden=false;
    }
  });
  initHeroVideo();
})();
