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
const buyerName = document.getElementById("buyerName");
const buyerEmail = document.getElementById("buyerEmail");
const buyerDetails = document.getElementById("checkoutBuyerDetails");
const afterPayment = document.getElementById("checkoutAfterPayment");
const registerAfterPayment = document.getElementById("registerAfterPayment");
const loginAfterPayment = document.getElementById("loginAfterPayment");
let baseCoursePrice = 0;

function brl(value) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function updateCheckoutTotal() {
  const amount = Math.round(baseCoursePrice * 100) + (telegramAddon.checked ? 999 : 0);
  coursePrice.textContent = brl(amount / 100);
  telegramTotalNote.textContent = telegramAddon.checked
    ? "Curso + consultoria vitalícia pelo Telegram"
    : "Curso sem consultoria adicional";
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
  updateCheckoutTotal();
  payButton.disabled = false;
  showReturn();
  const { data: { user } } = await sb.auth.getUser();
  if (user?.email) buyerEmail.value = user.email;
  if (user?.user_metadata?.full_name) buyerName.value = user.user_metadata.full_name;
}

payButton.addEventListener("click", async () => {
  if (!buyerName.reportValidity() || !buyerEmail.reportValidity()) return;
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
        telegram_addon: telegramAddon.checked
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
