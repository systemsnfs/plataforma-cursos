/* Reproduz o vídeo configurado pelo administrador, sem alterar o layout original. */
(() => {
  const playButton=document.getElementById("homeHeroPlay");
  const closeButton=document.getElementById("homeHeroClose");
  const player=document.getElementById("homeHeroVideo");
  const preview=document.getElementById("homeHeroPreview");
  const previewShade=document.getElementById("homeHeroPreviewShade");
  const errorBox=document.getElementById("homeHeroVideoError");
  if(!playButton||!closeButton||!player)return;
  const client=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
  let videoUrl=null;

  // Um quadro real do vídeo substitui o fundo verde antes do visitante clicar.
  // A prévia não toca áudio nem reproduz automaticamente.
  function loadPreview(url) {
    if(!preview||!previewShade)return;
    let shown=false;
    const showFrame=()=>{
      if(shown || !preview.videoWidth)return;
      shown=true;
      preview.hidden=false;
      previewShade.hidden=false;
    };
    preview.addEventListener("loadeddata",showFrame,{once:true});
    preview.addEventListener("seeked",showFrame,{once:true});
    preview.addEventListener("loadedmetadata",()=>{
      try {
        // Evita quadros iniciais totalmente pretos em arquivos com intro.
        if(Number.isFinite(preview.duration) && preview.duration>0.5){
          preview.currentTime=Math.min(0.35,preview.duration/3);
        }
      }catch(error){console.warn("Não foi possível posicionar a prévia:",error);}
    },{once:true});
    preview.addEventListener("error",()=>console.warn("Não foi possível carregar o quadro de prévia do vídeo."),{once:true});
    preview.src=url;
    preview.load();
  }

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
      loadPreview(videoUrl);
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
