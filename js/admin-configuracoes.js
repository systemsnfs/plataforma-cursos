const pricingClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
const pricingForm=document.getElementById("telegramPricingForm");
const pricingStatus=document.getElementById("pricingFormStatus");
const pricingLoad=document.getElementById("pricingLoadStatus");
const pricingSave=document.getElementById("saveTelegramPrices");
const formatted=cents=>(cents/100).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
function centsFromInput(raw){
 const s=String(raw).trim().replace(/^R\$\s*/,"").replace(/\s/g,"");
 if(!/^\d{1,5}(?:[,.]\d{1,2})?$/.test(s))throw new Error("Use valores como 9,99 ou 27,99, sem símbolo de moeda.");
 const parts=s.split(/[,.]/);
 const cents=Number(parts[0])*100+Number((parts[1]||"").padEnd(2,"0"));
 if(!Number.isSafeInteger(cents)||cents<100||cents>1000000)throw new Error("Informe um preço entre R$ 1,00 e R$ 10.000,00.");
 return cents;
}
async function startPricingSettings(){
 try{
  const {data:{user},error:authError}=await pricingClient.auth.getUser();
  if(authError||!user){location.href="login.html";return;}
  const {data:profile,error:profileError}=await pricingClient.from("profiles").select("role,active").eq("id",user.id).maybeSingle();
  if(profileError||profile?.role!=="admin"||profile?.active===false){
   pricingLoad.textContent="Acesso negado. Esta seção é exclusiva do administrador.";return;
  }
  const {data,error}=await pricingClient.from("telegram_pricing").select("bundled_price_cents,later_price_cents").eq("id",1).single();
  if(error||!data){pricingLoad.textContent="Não foi possível carregar os preços: "+(error?.message||"Configuração indisponível.");return;}
  document.getElementById("bundlePrice").value=formatted(data.bundled_price_cents);
  document.getElementById("laterPrice").value=formatted(data.later_price_cents);
  pricingForm.hidden=false;
  pricingLoad.hidden=true;
 }catch(error){pricingLoad.textContent="Não foi possível carregar as configurações: "+error.message;}
}
pricingForm.addEventListener("submit",async event=>{
 event.preventDefault();
 if(pricingSave.disabled)return;
 let bundled,later;
 try{
  bundled=centsFromInput(document.getElementById("bundlePrice").value);
  later=centsFromInput(document.getElementById("laterPrice").value);
 }catch(error){pricingStatus.textContent=error.message;pricingStatus.classList.add("error");return;}
 pricingSave.disabled=true;
 pricingStatus.textContent="Salvando os novos valores...";
 pricingStatus.classList.remove("error");
 try{
  const {data,error}=await pricingClient.from("telegram_pricing").update({
    bundled_price_cents:bundled,later_price_cents:later
  }).eq("id",1).select("bundled_price_cents,later_price_cents").single();
  if(error||!data)throw error||new Error("Os valores não foram atualizados.");
  document.getElementById("bundlePrice").value=formatted(data.bundled_price_cents);
  document.getElementById("laterPrice").value=formatted(data.later_price_cents);
  pricingStatus.textContent="Preços atualizados com sucesso!";
 }catch(error){pricingStatus.textContent="Não foi possível salvar: "+(error?.message||"Erro desconhecido");pricingStatus.classList.add("error");}
 finally{pricingSave.disabled=false;}
});
document.getElementById("logoutSettings").addEventListener("click",async()=>{await pricingClient.auth.signOut();location.href="index.html";});
startPricingSettings();