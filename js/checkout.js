const sb = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);


const params =
  new URLSearchParams(window.location.search);

const courseId =
  params.get("course_id");


const courseTitle =
  document.getElementById("courseTitle");

const courseDescription =
  document.getElementById("courseDescription");

const coursePrice =
  document.getElementById("coursePrice");

const payButton =
  document.getElementById("payButton");

const checkoutMessage =
  document.getElementById("checkoutMessage");


const telegramAddon = document.getElementById("telegramAddon");
const telegramTotalNote = document.getElementById("telegramTotalNote");
const TELEGRAM_ADDON_PRICE = 9.99;
let baseCoursePrice = 0;

function formatCheckoutBRL(value) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function updateCheckoutTotal() {
  const selected = telegramAddon.checked;
  const totalCents = Math.round(baseCoursePrice * 100) + (selected ? 999 : 0);
  coursePrice.textContent = formatCheckoutBRL(totalCents / 100);
  telegramTotalNote.textContent = selected
    ? "Curso + consultoria vitalícia pelo Telegram"
    : "Curso sem consultoria adicional";
}

telegramAddon.addEventListener("change", updateCheckoutTotal);

async function initCheckout() {

  /* =====================================
     VERIFICAR CURSO
  ===================================== */

  if (!courseId) {

    checkoutMessage.textContent =
      "Curso não informado.";

    courseTitle.textContent =
      "Curso indisponível";

    courseDescription.textContent =
      "Volte para a página inicial e escolha um curso.";

    return;
  }


  /* =====================================
     VERIFICAR LOGIN
  ===================================== */

  const {
    data: { user }
  } = await sb.auth.getUser();


  if (!user) {

    const destination =
      `checkout.html?course_id=${encodeURIComponent(courseId)}`;

    location.href =
      `login.html?next=${encodeURIComponent(destination)}`;

    return;
  }


  /* =====================================
     BUSCAR CURSO
  ===================================== */

  const {
    data: course,
    error
  } = await sb
    .from("courses")
    .select(`
      id,
      title,
      description,
      price
    `)
    .eq("id", courseId)
    .maybeSingle();


  if (error || !course) {

    console.error(
      "Erro ao carregar curso:",
      error
    );

    courseTitle.textContent =
      "Curso indisponível";

    courseDescription.textContent =
      "Não foi possível carregar este curso.";

    checkoutMessage.textContent =
      "Verifique o curso selecionado e tente novamente.";

    return;
  }


  /* =====================================
     MOSTRAR DADOS
  ===================================== */

  courseTitle.textContent =
    course.title || "Curso";


  courseDescription.textContent =
    course.description ||
    "Curso online Academia Online.";


  baseCoursePrice = Number(course.price || 0);
  updateCheckoutTotal();

  payButton.disabled = false;

}


payButton.addEventListener(
  "click",
  () => {

    checkoutMessage.textContent =
      "Pagamento será conectado ao Mercado Pago na próxima etapa.";

  }
);


initCheckout();
