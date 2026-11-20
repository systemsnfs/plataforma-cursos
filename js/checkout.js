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
const accountActions = document.getElementById("checkoutAccountActions");
const switchStudentAccount = document.getElementById("switchStudentAccount");
const createStudentAccount = document.getElementById("createStudentAccount");
const TELEGRAM_ADDON_PRICE = 9.99;

async function startStudentAccountFlow(mode) {
  switchStudentAccount.disabled = true;
  createStudentAccount.disabled = true;
  checkoutMessage.textContent = "Preparando o acesso à sua conta...";
  const { error } = await sb.auth.signOut();
  if (error) {
    checkoutMessage.textContent = "Não foi possível trocar de conta. Tente novamente.";
    switchStudentAccount.disabled = false;
    createStudentAccount.disabled = false;
    return;
  }
  location.replace(`${mode}.html?course_id=${encodeURIComponent(courseId)}`);
}

switchStudentAccount.addEventListener("click", () => startStudentAccountFlow("login"));
createStudentAccount.addEventListener("click", () => startStudentAccountFlow("cadastro"));
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
    location.replace(`login.html?course_id=${encodeURIComponent(courseId)}`);
    return;
  }

  // O pagamento exige uma conta de aluno registrada e ativa.
  const { data: profile, error: profileError } = await sb
    .from("profiles")
    .select("role,active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile || profile.active !== true || profile.role !== "student") {
    payButton.disabled = true;
    accountActions.hidden = false;
    checkoutMessage.textContent = profileError
      ? "Não foi possível validar sua conta. Entre novamente como aluno."
      : !profile
        ? "Esta sessão não possui um perfil de aluno. Entre ou crie uma conta de aluno."
        : profile.role !== "student"
          ? "Você está conectado com uma conta administrativa. Para testar a compra, use uma conta de aluno."
          : "Esta conta está desativada. Entre com outra conta de aluno.";
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


payButton.addEventListener("click", async () => {
  payButton.disabled = true;
  checkoutMessage.textContent = "Preparando seu pagamento seguro...";
  try {
    const { data: { session }, error: sessionError } = await sb.auth.getSession();
    if (sessionError || !session?.access_token) {
      location.href = `login.html?course_id=${encodeURIComponent(courseId)}`;
      return;
    }
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/create-payment`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          course_id: courseId,
          telegram_addon: telegramAddon.checked
        })
      }
    );
    const result = await response.json();
    if (!response.ok || !result.checkout_url) {
      throw new Error(result.error || "Não foi possível iniciar o pagamento.");
    }
    checkoutMessage.textContent = "Redirecionando ao Mercado Pago...";
    location.assign(result.checkout_url);
  } catch (error) {
    checkoutMessage.textContent = error.message || "Tente novamente.";
    payButton.disabled = false;
  }
});


if (params.get("retorno")) {
  const messages = {
    sucesso: "Retorno recebido. O acesso será liberado somente após a confirmação do Mercado Pago.",
    falha: "O pagamento não foi concluído. Você pode tentar novamente.",
    pendente: "Pagamento pendente. O acesso será liberado quando houver confirmação."
  };
  checkoutMessage.textContent = messages[params.get("retorno")] || "";
}

initCheckout();
