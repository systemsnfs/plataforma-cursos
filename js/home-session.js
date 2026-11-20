const homeAuthLink = document.getElementById("homeAuthLink");
const homeLogoutButton = document.getElementById("homeLogoutButton");
const homeClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function refreshHomeAuth() {
  try {
    const { data: { user } } = await homeClient.auth.getUser();
    if (user) {
      homeAuthLink.textContent = "Minha área";
      homeAuthLink.href = "aluno.html";
      homeLogoutButton.hidden = false;
      homeLogoutButton.style.display = "inline-flex";
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
