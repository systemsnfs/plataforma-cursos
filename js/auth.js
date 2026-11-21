const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const message = document.getElementById("message");

/* =====================================================
   CURSO / REDIRECIONAMENTO
===================================================== */

const params =
  new URLSearchParams(window.location.search);

const courseId =
  params.get("course_id");

// Preserva apenas destinos internos válidos (evita redirecionamento externo).
const requestedNext = params.get("next");
const safeNext = requestedNext &&
  !requestedNext.startsWith("/") &&
  !requestedNext.includes("://") &&
  !requestedNext.includes("\\") &&
  /^(checkout|aluno)\.html(?:\?.*)?$/.test(requestedNext)
    ? requestedNext
    : null;
const purchaseCourseId = courseId || (safeNext?.startsWith("checkout.html")
  ? new URLSearchParams(safeNext.split("?")[1] || "").get("course_id")
  : null);


/* =====================================
   LINK LOGIN → CADASTRO
===================================== */

const registerLink =
  document.getElementById("registerLink");

if (registerLink && purchaseCourseId) {

  registerLink.href =
    `cadastro.html?course_id=${encodeURIComponent(purchaseCourseId)}`;

}


/* =====================================
   LINK CADASTRO → LOGIN
===================================== */

const loginLink =
  document.getElementById("loginLink");

if (loginLink && courseId) {

  loginLink.href =
    `login.html?course_id=${encodeURIComponent(courseId)}`;

}

async function activatePurchases() {
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session?.access_token) return;
    const response = await fetch(SUPABASE_URL + "/functions/v1/claim-purchases", {
      method: "POST",
      headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": "Bearer " + session.access_token, "Content-Type": "application/json" },
      body: "{}"
    });
    if (!response.ok) console.warn("Compra ainda não disponível para vinculação.");
  } catch (error) {
    console.warn("Não foi possível verificar compras no momento.", error);
  }
}

/* =====================================================
   LOGIN
===================================================== */

if (loginForm) {

  loginForm.addEventListener("submit", async (e) => {

    e.preventDefault();

    message.textContent = "Entrando...";


    /* =========================
       FAZER LOGIN
    ========================= */

    const {
      data,
      error
    } = await supabaseClient.auth.signInWithPassword({

      email: document.getElementById("email").value,
      password: document.getElementById("password").value

    });


    if (error) {

      message.textContent = error.message;

      return;

    }


    const user = data.user;


    if (!user) {

      message.textContent =
        "Não foi possível identificar o usuário.";

      return;

    }


    /* =========================
       BUSCAR PERFIL
    ========================= */

    message.textContent =
      "Carregando seu perfil...";


    const {
      data: profile,
      error: profileError
    } = await supabaseClient
      .from("profiles")
      .select("role, active")
      .eq("id", user.id)
      .maybeSingle();


    if (profileError) {

      console.error(
        "Erro ao carregar perfil:",
        profileError
      );

      message.textContent =
        "Não foi possível carregar seu perfil.";

      return;

    }


    if (!profile) {

      message.textContent =
        "Perfil do usuário não encontrado.";

      return;

    }


    /* =========================
       VERIFICAR SE ESTÁ ATIVO
    ========================= */

    if (profile.active === false) {

      await supabaseClient.auth.signOut();

      message.textContent =
        "Seu acesso está desativado.";

      return;

    }


    /* =========================
       REDIRECIONAMENTO
    ========================= */

    if (profile.role === "admin") {

      location.href = "admin.html";

      return;

    }

if (profile.role === "student") {

  message.textContent = "Verificando suas compras...";
  await activatePurchases();

  if (safeNext) {
    location.href = safeNext;
    return;
  }

  /* Veio da compra de um curso */
  if (courseId) {

    location.href =
      `checkout.html?course_id=${encodeURIComponent(courseId)}`;

    return;

  }


  /* Login normal */
  location.href = "aluno.html";

  return;

}

    /* =========================
       PERFIL DESCONHECIDO
    ========================= */

    await supabaseClient.auth.signOut();

    message.textContent =
      "Tipo de usuário não autorizado.";

  });

}


/* =====================================================
   CADASTRO
===================================================== */

if (registerForm) {

  registerForm.addEventListener("submit", async (e) => {

    e.preventDefault();

    message.textContent =
      "Criando conta...";


    const {
      data,
      error
    } = await supabaseClient.auth.signUp({

      email: document.getElementById("email").value,

      password: document.getElementById("password").value,

      options: {

        data: {

          full_name:
            document.getElementById("name").value

        },

      emailRedirectTo: courseId
  ? `https://systemsnfs.github.io/plataforma-cursos/login.html?course_id=${encodeURIComponent(courseId)}`
  : "https://systemsnfs.github.io/plataforma-cursos/login.html"

      }

    });


    if (error) {

      message.textContent =
        error.message;

      return;

    }


    if (data.session) {
      await activatePurchases();
      location.href = "aluno.html";
      return;
    }

    message.textContent =
      "Conta criada. Confirme seu e-mail e faça login para liberar o curso após a aprovação do pagamento.";

  });

}
