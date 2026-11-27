/* Vídeo de apresentação da página inicial: somente administrador. */
(() => {
  const api = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const section = document.getElementById("homeVideoSection");
  if (!section) return;

  const input = document.getElementById("homeVideoFile");
  const choose = document.getElementById("homeVideoChoose");
  const save = document.getElementById("homeVideoSave");
  const remove = document.getElementById("homeVideoRemove");
  const filename = document.getElementById("homeVideoFilename");
  const info = document.getElementById("homeVideoExisting");
  const status = document.getElementById("homeVideoStatus");
  const progress = document.getElementById("homeVideoProgress");
  const previewBox = document.getElementById("homeVideoPreview");
  const preview = document.getElementById("homeVideoPreviewPlayer");

  let currentPath = null;
  let busy = false;
  const maxBytes = 500 * 1024 * 1024; // O limite real também depende do plano Supabase.
  const allowed = {mp4:"video/mp4",webm:"video/webm",mov:"video/quicktime"};

  function report(message,isError=false) {
    status.textContent=message;
    status.classList.toggle("error",isError);
  }
  function updateControls() {
    choose.disabled=busy;
    save.disabled=busy || !input.files?.length;
    remove.disabled=busy || !currentPath;
  }
  function cleanPreview() {
    preview.pause();
    preview.removeAttribute("src");
    preview.load();
    previewBox.hidden=true;
  }
  function showPreview(path) {
    cleanPreview();
    if (!path) return;
    preview.src=api.storage.from("videos").getPublicUrl(path).data.publicUrl;
    previewBox.hidden=false;
  }
  function extAndMime(file) {
    const ext=(file.name.split(".").pop()||"").toLowerCase();
    if (!allowed[ext] || (file.type && ![allowed[ext],"application/octet-stream"].includes(file.type))) {
      throw new Error("Selecione um vídeo MP4, WebM ou MOV.");
    }
    if(file.size<=0 || file.size>maxBytes) throw new Error("Escolha um vídeo de até 500 MB. O armazenamento pode ter um limite menor.");
    return {ext,mime:allowed[ext]};
  }
  async function loadCurrent() {
    const {data,error}=await api.from("homepage_media").select("video_path").eq("id",1).single();
    if(error)throw error;
    currentPath=data?.video_path||null;
    info.textContent=currentPath?"Vídeo atual publicado. É possível reproduzir a prévia abaixo.":"Nenhum vídeo configurado. O card manterá seu visual atual até você salvar um vídeo.";
    showPreview(currentPath);
    updateControls();
  }
  async function uploadVideo(file,path,mime) {
    if(file.size<=6*1024*1024) {
      const {error}=await api.storage.from("videos").upload(path,file,{contentType:mime,upsert:false});
      if(error)throw error;
      progress.value=100;
      return;
    }
    if(!window.tus?.Upload)throw new Error("O carregador de vídeos não foi iniciado. Atualize a página.");
    const {data:{session},error:sessionError}=await api.auth.getSession();
    if(sessionError||!session?.access_token)throw new Error("Sua sessão expirou. Faça login novamente.");
    const host=new URL(SUPABASE_URL).hostname.replace(".supabase.co",".storage.supabase.co");
    await new Promise((resolve,reject)=>{
      const upload=new window.tus.Upload(file,{
        endpoint:"https://"+host+"/storage/v1/upload/resumable",
        retryDelays:[0,3000,5000,10000],
        chunkSize:6*1024*1024,
        uploadDataDuringCreation:true,
        removeFingerprintOnSuccess:true,
        headers:{authorization:"Bearer "+session.access_token,"x-upsert":"false"},
        metadata:{bucketName:"videos",objectName:path,contentType:mime,cacheControl:"3600"},
        onProgress(uploaded,total){
          progress.value=total?Math.round(uploaded*100/total):0;
          report("Enviando vídeo: "+progress.value+"%. Não feche esta janela.");
        },
        onError(error){reject(error);},
        onSuccess(){resolve();}
      });
      upload.start();
    });
  }
  async function removeOldFile(path) {
    if(!path?.startsWith("homepage/"))return null;
    const {error}=await api.storage.from("videos").remove([path]);
    return error;
  }

  async function init() {
    try {
      const {data:{user},error:authError}=await api.auth.getUser();
      if(authError||!user)return;
      const {data:profile,error:profileError}=await api.from("profiles").select("role,active").eq("id",user.id).maybeSingle();
      if(profileError||profile?.role!=="admin"||profile.active===false)return;
      section.hidden=false;
      await loadCurrent();
    } catch(error) {
      section.hidden=false;
      info.textContent="Não foi possível verificar o vídeo atual.";
      report(error.message||"Erro ao consultar configurações.",true);
    }
  }

  choose.addEventListener("click",()=>input.click());
  input.addEventListener("change",()=>{
    const file=input.files?.[0];
    filename.textContent=file?file.name:"Nenhum arquivo selecionado";
    if(file) {
      try {extAndMime(file);report("Vídeo selecionado. Clique em Salvar vídeo para publicar.");}
      catch(error){report(error.message,true);input.value="";filename.textContent="Nenhum arquivo selecionado";}
    }
    updateControls();
  });

  save.addEventListener("click",async()=>{
    if(busy || !input.files?.length)return;
    const file=input.files[0];
    let ext,mime;
    try{({ext,mime}=extAndMime(file));}catch(error){report(error.message,true);return;}
    busy=true;updateControls();progress.hidden=false;progress.value=0;
    const newPath="homepage/"+crypto.randomUUID()+"."+ext;
    let uploaded=false;
    try {
      report("Preparando envio do vídeo...");
      await uploadVideo(file,newPath,mime);
      uploaded=true;
      report("Vídeo enviado. Publicando no site...");
      let change=api.from("homepage_media").update({video_path:newPath,updated_at:new Date().toISOString()}).eq("id",1);
      change=currentPath?change.eq("video_path",currentPath):change.is("video_path",null);
      const {data,error}=await change.select("video_path");
      if(error)throw error;
      if(!data?.length)throw new Error("Outro administrador alterou o vídeo. Atualize a página e tente novamente.");
      const oldPath=currentPath;
      currentPath=newPath;
      input.value="";
      filename.textContent="Nenhum arquivo selecionado";
      showPreview(currentPath);
      info.textContent="Vídeo atual publicado. É possível reproduzir a prévia abaixo.";
      report("Vídeo publicado! O botão ▶ da página inicial já poderá reproduzi-lo.");
      // Só elimina o arquivo anterior depois de confirmar que o novo já foi publicado.
      if(oldPath && oldPath!==newPath) {
        const cleanupError=await removeOldFile(oldPath);
        if(cleanupError)console.warn("Arquivo antigo preservado:",cleanupError);
      }
    }catch(error){
      console.error("Falha ao salvar vídeo de apresentação:",error);
      report("Não foi possível publicar o vídeo: "+(error.message||"Erro desconhecido."),true);
      if(uploaded) {
        const cleanupError=await removeOldFile(newPath);
        if(cleanupError)console.warn("Não foi possível limpar envio sem publicação:",cleanupError);
      }
    }finally{busy=false;progress.hidden=true;updateControls();}
  });

  remove.addEventListener("click",async()=>{
    if(busy||!currentPath)return;
    if(!confirm("Remover o vídeo de apresentação da página inicial? O card continuará visível, mas sem vídeo."))return;
    busy=true;updateControls();
    const oldPath=currentPath;
    try{
      report("Removendo vídeo da página inicial...");
      const {data,error}=await api.from("homepage_media").update({video_path:null,updated_at:new Date().toISOString()}).eq("id",1).eq("video_path",oldPath).select("video_path");
      if(error)throw error;
      if(!data?.length)throw new Error("O vídeo foi alterado em outra sessão. Atualize a página.");
      currentPath=null;
      cleanPreview();
      info.textContent="Nenhum vídeo configurado. O card manterá seu visual atual até você salvar um vídeo.";
      const cleanupError=await removeOldFile(oldPath);
      report(cleanupError?"Vídeo retirado da página inicial. O arquivo anterior permaneceu no armazenamento.":"Vídeo removido com sucesso.",!!cleanupError);
    }catch(error){report("Não foi possível remover: "+(error.message||"Erro desconhecido."),true);}
    finally{busy=false;updateControls();}
  });
  init();
})();
