/* Configuração da imagem de fundo no painel administrativo. */
(() => {
 const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
 const section=document.getElementById("heroImageSection");
 if(!section)return;
 const fileInput=document.getElementById("heroImageFile");
 const choose=document.getElementById("heroImageChoose");
 const save=document.getElementById("heroImageSave");
 const remove=document.getElementById("heroImageRemove");
 const filename=document.getElementById("heroImageFilename");
 const preview=document.getElementById("heroImagePreview");
 const current=document.getElementById("heroImageCurrent");
 const status=document.getElementById("heroImageStatus");
 let path=null,blobUrl=null,busy=false;
 const fileTypes={jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",webp:"image/webp"};
 function inform(text,error=false){status.textContent=text;status.classList.toggle("error",error);}
 function controls(){choose.disabled=busy;save.disabled=busy||!fileInput.files?.length;remove.disabled=busy||!path;}
 function showPreview(url){if(blobUrl){URL.revokeObjectURL(blobUrl);blobUrl=null;}if(url){preview.src=url;preview.style.display="block";}else{preview.removeAttribute("src");preview.style.display="none";}}
 function validate(file){
  if(!file)throw new Error("Selecione uma imagem.");
  const ext=(file.name.split(".").pop()||"").toLowerCase();
  if(!fileTypes[ext]||file.type&&fileTypes[ext]!==file.type)throw new Error("Selecione JPG, PNG ou WebP.");
  if(file.size<=0||file.size>12*1024*1024)throw new Error("Imagem inválida ou maior que 12 MB.");
  return {ext,mime:fileTypes[ext]};
 }
 async function load(){
  const {data,error}=await db.from("homepage_media").select("background_image_path").eq("id",1).single();
  if(error)throw error;
  path=data?.background_image_path||null;
  current.textContent=path?"Imagem de fundo personalizada publicada.":"Imagem original do site em uso.";
  if(path)showPreview(db.storage.from("materiais").getPublicUrl(path).data.publicUrl);
  else showPreview(null);
  controls();
 }
 async function init(){
  try{
   const {data:{user},error:authError}=await db.auth.getUser();
   if(authError||!user)return;
   const {data:profile,error:profileError}=await db.from("profiles").select("role,active").eq("id",user.id).maybeSingle();
   if(profileError||profile?.role!=="admin"||profile.active===false)return;
   section.hidden=false;
   await load();
  }catch(error){section.hidden=false;inform("Erro ao carregar a configuração: "+error.message,true);}
 }
 choose.addEventListener("click",()=>fileInput.click());
 fileInput.addEventListener("change",()=>{
  const file=fileInput.files?.[0];
  filename.textContent=file?.name||"Nenhuma foto selecionada";
  if(file){try{validate(file);blobUrl=URL.createObjectURL(file);preview.src=blobUrl;preview.style.display="block";inform("Foto selecionada. Clique em Publicar imagem no site.");}catch(error){inform(error.message,true);fileInput.value="";}}
  controls();
 });
 save.addEventListener("click",async()=>{
  if(busy||!fileInput.files?.length)return;
  const file=fileInput.files[0];
  let ext,mime;try{({ext,mime}=validate(file));}catch(error){inform(error.message,true);return;}
  busy=true;controls();
  const newPath="homepage/hero-"+crypto.randomUUID()+"."+ext;
  let uploaded=false,published=false;
  try{
   inform("Enviando foto para o site...");
   const {error:uploadError}=await db.storage.from("materiais").upload(newPath,file,{contentType:mime,cacheControl:"3600",upsert:false});
   if(uploadError)throw uploadError;
   uploaded=true;
   let update=db.from("homepage_media").update({background_image_path:newPath,updated_at:new Date().toISOString()}).eq("id",1);
   update=path?update.eq("background_image_path",path):update.is("background_image_path",null);
   const {data,error}=await update.select("background_image_path");
   if(error)throw error;
   if(!data?.length)throw new Error("Esta configuração foi alterada em outra sessão. Atualize e tente novamente.");
   published=true;
   const old=path;path=newPath;fileInput.value="";filename.textContent="Nenhuma foto selecionada";
   showPreview(db.storage.from("materiais").getPublicUrl(path).data.publicUrl);
   current.textContent="Imagem de fundo personalizada publicada.";
   inform("Imagem publicada! Abra a página inicial e atualize-a para visualizar.");
   if(old&&old.startsWith("homepage/hero-")){const {error:removeError}=await db.storage.from("materiais").remove([old]);if(removeError)console.warn("Arquivo de fundo anterior mantido:",removeError);}
  }catch(error){
   inform("Não foi possível publicar: "+(error.message||"Erro desconhecido"),true);
   if(uploaded&&!published)await db.storage.from("materiais").remove([newPath]);
  }finally{busy=false;controls();}
 });
 remove.addEventListener("click",async()=>{
  if(busy||!path||!confirm("Restaurar a imagem original de fundo da página inicial?"))return;
  busy=true;controls();const old=path;
  try{
   let update=db.from("homepage_media").update({background_image_path:null,updated_at:new Date().toISOString()}).eq("id",1).eq("background_image_path",old);
   const {data,error}=await update.select("background_image_path");
   if(error)throw error;
   if(!data?.length)throw new Error("A configuração foi alterada em outra sessão.");
   path=null;fileInput.value="";filename.textContent="Nenhuma foto selecionada";
   showPreview(null);current.textContent="Imagem original do site em uso.";
   inform("Imagem original restaurada.");
   if(old.startsWith("homepage/hero-")){const {error:removeError}=await db.storage.from("materiais").remove([old]);if(removeError)console.warn("Arquivo anterior mantido:",removeError);}
  }catch(error){inform("Falha ao restaurar fundo: "+error.message,true);}
  finally{busy=false;controls();}
 });
 init();
})();
