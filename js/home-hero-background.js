/* Carrega a foto de fundo publicada pelo ADM, preservando parallax e contraste. */
(() => {
 const hero=document.querySelector(".legion-home .premium-home-hero");
 if(!hero)return;
 const client=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
 async function loadHeroBackground(){
  try{
   const {data,error}=await client.from("homepage_media").select("background_image_path").eq("id",1).single();
   if(error)throw error;
   const path=data?.background_image_path;
   if(!path)return;
   if(!/^homepage\/hero-[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$/.test(path))return;
   const publicUrl=client.storage.from("materiais").getPublicUrl(path).data.publicUrl;
   const url=new URL(publicUrl);
   if(url.protocol!=="https:")return;
   // inline important supera o antigo background do tema sem remover o parallax.
   hero.style.setProperty("background-image",
    "linear-gradient(90deg,rgba(14,30,21,.96) 0%,rgba(19,37,27,.87) 43%,rgba(18,34,25,.37) 100%),url('"+url.href+"')",
    "important");
  }catch(error){console.warn("Não foi possível carregar a foto de fundo personalizada:",error);}
 }
 loadHeroBackground();
})();
