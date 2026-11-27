const homeAuthLink = document.getElementById("homeAuthLink");
const homeLogoutButton = document.getElementById("homeLogoutButton");
const homeClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function refreshHomeAuth() {
  try {
    const { data: { user } } = await homeClient.auth.getUser();
    if (user) {
      // O destino depende do papel atribuído ao usuário no Supabase.
      const { data: profile, error: profileError } = await homeClient
        .from("profiles")
        .select("role, active")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError || !profile || profile.active === false) {
        homeAuthLink.textContent = "Entrar";
        homeAuthLink.href = "login.html";
        homeLogoutButton.hidden = false;
        homeLogoutButton.style.display = "inline-flex";
      } else {
        homeAuthLink.textContent = profile.role === "admin" ? "Painel ADM" : "Minha área";
        homeAuthLink.href = profile.role === "admin" ? "admin.html" : "aluno.html";
        homeLogoutButton.hidden = false;
        homeLogoutButton.style.display = "inline-flex";
      }
    } else {
      homeAuthLink.textContent = "Entrar";
      homeAuthLink.href = "login.html";
      homeLogoutButton.hidden = true;
      homeLogoutButton.style.display = "none";
    }
  } catch (error) {
    console.warn("Não foi possível verificar a sessão da página inicial", error);
  }
}
homeLogoutButton.addEventListener("click", async () => {
  homeLogoutButton.disabled = true;
  const { error } = await homeClient.auth.signOut();
  homeLogoutButton.disabled = false;
  if (error) {
    alert("Não foi possível sair. Tente novamente.");
    return;
  }
  await refreshHomeAuth();
});
refreshHomeAuth();

const HOME_COURSE_ID = "0385b572-c4ee-48b6-9e8b-50af39df6b58";

async function loadHomeCoursePrice() {
  const priceElement = document.getElementById("homeCoursePrice");
  const buyButton = document.getElementById("homeCourseBuyButton");
  if (!priceElement) return;

  try {
    const { data: course, error } = await homeClient
      .from("courses")
      .select("price, active")
      .eq("id", HOME_COURSE_ID)
      .maybeSingle();

    if (error || !course || !course.active || !Number.isFinite(Number(course.price))) {
      throw error || new Error("Curso ou preço indisponível");
    }

    priceElement.textContent = Number(course.price).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });
    if (buyButton) {
      buyButton.href = "checkout.html?course_id=" + encodeURIComponent(HOME_COURSE_ID);
      buyButton.style.pointerEvents = "";
      buyButton.removeAttribute("aria-disabled");
    }
  } catch (error) {
    console.warn("Não foi possível atualizar o preço do curso:", error);
    priceElement.textContent = "Consulte o valor";
    if (buyButton) {
      buyButton.style.pointerEvents = "none";
      buyButton.setAttribute("aria-disabled", "true");
    }
  }
}
loadHomeCoursePrice();

/* Preço promocional do Telegram sempre sincronizado com as configurações do ADM. */
async function loadHomeTelegramPrice() {
  const element = document.getElementById("homeTelegramPrice");
  if (!element) return;
  try {
    const {data,error} = await homeClient.from("telegram_pricing")
      .select("bundled_price_cents").eq("id",1).single();
    if(error||!Number.isSafeInteger(data?.bundled_price_cents))throw error||new Error("Preço indisponível");
    element.textContent="+ "+(data.bundled_price_cents/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
  } catch (error) {
    element.textContent="Consulte o valor";
    console.warn("Não foi possível carregar preço Telegram da página inicial:",error);
  }
}
loadHomeTelegramPrice();
