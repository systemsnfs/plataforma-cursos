const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const params = new URLSearchParams(location.search);
const courseId = params.get("course_id");
const courseTitle = document.getElementById("courseTitle");
const courseDescription = document.getElementById("courseDescription");
const coursePrice = document.getElementById("coursePrice");
const payButton = document.getElementById("payButton");
const checkoutMessage = document.getElementById("checkoutMessage");
const telegramAddon = document.getElementById("telegramAddon");
const telegramTotalNote = document.getElementById("telegramTotalNote");
const installmentsPrice = document.getElementById("checkoutInstallments");
const telegramOfferCard = document.getElementById("telegramOfferCard");
const telegramSelectHint = document.getElementById("telegramSelectHint");
const buyerName = document.getElementById("buyerName");
const buyerEmail = document.getElementById("buyerEmail");
const buyerDetails = document.getElementById("checkoutBuyerDetails");
const afterPayment = document.getElementById("checkoutAfterPayment");
const registerAfterPayment = document.getElementById("registerAfterPayment");
const loginAfterPayment = document.getElementById("loginAfterPayment");
let baseCoursePrice = 0;
let bundledTelegramCents = null;

function brl(value) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function updateCheckoutTotal() {
  const selected = telegramAddon.checked;
  const amountCents = Math.round(baseCoursePrice * 100) + (selected ? (bundledTelegramCents ?? 0) : 0);
  // A parcela apresentada é uma simulação aritmética. A cobrança efetiva
  // e as opções de parcelamento são determinadas pelo Mercado Pago.
  const installmentCents = Math.round(amountCents / 10);
  installmentsPrice.textContent = "10x de " + brl(installmentCents / 100);
  coursePrice.textContent = brl(amountCents / 100);
  telegramTotalNote.textContent = selected
    ? "Curso + consultoria vitalícia pelo Telegram"
    : "Curso sem consultoria adicional";
  telegramOfferCard.classList.toggle("is-selected", selected);
  telegramSelectHint.textContent = selected
    ? "✓ Consultoria adicionada ao seu pedido"
    : "Clique para adicionar ao seu curso";
}

function showReturn() {
  const status = params.get("retorno");
  if (!status) return;
  if (status === "sucesso") {
    payButton.hidden = true;
    buyerDetails.hidden = true;
    afterPayment.hidden = false;
    const qp = new URLSearchParams();
    if (courseId) qp.set("course_id", courseId);
    if (params.get("pedido")) qp.set("pedido", params.get("pedido"));
    registerAfterPayment.href = "cadastro.html?" + qp.toString();
    loginAfterPayment.href = "login.html?" + qp.toString();
    checkoutMessage.textContent = "Retorno do pagamento recebido. Crie sua conta com o MESMO e-mail informado na compra. O acesso só será liberado após a confirmação do Mercado Pago.";
  } else if (status === "pendente") {
    checkoutMessage.textContent = "Pagamento pendente. Aguarde a aprovação antes de criar sua conta.";
    payButton.disabled = true;
  } else if (status === "falha") {
    checkoutMessage.textContent = "Pagamento não concluído. Confira seus dados e tente novamente.";
  }
}

telegramAddon.addEventListener("change", updateCheckoutTotal);

async function initCheckout() {
  if (!courseId) {
    courseTitle.textContent = "Curso indisponível";
    checkoutMessage.textContent = "Volte para a página inicial e selecione o curso.";
    return;
  }
  const { data: course, error } = await sb.from("courses")
    .select("id,title,description,price,active").eq("id", courseId).maybeSingle();
  if (error || !course || !course.active) {
    courseTitle.textContent = "Curso indisponível";
    checkoutMessage.textContent = "Não foi possível carregar o curso.";
    return;
  }
  courseTitle.textContent = course.title;
  courseDescription.textContent = course.description || "Aulas e materiais da Legion Academy.";
  baseCoursePrice = Number(course.price || 0);
  // Lê o valor público que também é usado pelo servidor ao criar a cobrança.
  const {data:telegramPricing,error:pricingError} = await sb.from("telegram_pricing")
    .select("bundled_price_cents").eq("id",1).single();
  if(pricingError || !telegramPricing || !Number.isSafeInteger(telegramPricing.bundled_price_cents)){
    checkoutMessage.textContent = "Não foi possível consultar o preço da consultoria. Atualize a página para tentar novamente.";
    return;
  }
  bundledTelegramCents = telegramPricing.bundled_price_cents;
  const priceBadge = document.querySelector(".telegram-extra-price");
  if(priceBadge) priceBadge.textContent = "+ " + brl(bundledTelegramCents/100);
  updateCheckoutTotal();
  payButton.disabled = false;
  showReturn();
  const { data: { user } } = await sb.auth.getUser();
  if (user?.email) buyerEmail.value = user.email;
  if (user?.user_metadata?.full_name) buyerName.value = user.user_metadata.full_name;
}

payButton.addEventListener("click", async () => {
  if (!buyerName.reportValidity() || !buyerEmail.reportValidity()) return;
  if(bundledTelegramCents===null){
    checkoutMessage.textContent="Preço do Telegram indisponível. Atualize a página e tente novamente.";
    return;
  }
  payButton.disabled = true;
  checkoutMessage.textContent = "Preparando o pagamento seguro...";
  try {
    const response = await fetch(SUPABASE_URL + "/functions/v1/create-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY },
      body: JSON.stringify({
        course_id: courseId,
        name: buyerName.value.trim(),
        email: buyerEmail.value.trim(),
        telegram_addon: telegramAddon.checked,
        expected_telegram_cents: bundledTelegramCents
      })
    });
    const data = await response.json();
    if (!response.ok || !data.checkout_url) {
      throw new Error(data.error || "Não foi possível iniciar o pagamento.");
    }
    checkoutMessage.textContent = "Redirecionando para o Mercado Pago...";
    location.assign(data.checkout_url);
  } catch (error) {
    checkoutMessage.textContent = error.message || "Não foi possível realizar a operação.";
    payButton.disabled = false;
  }
});

initCheckout();
