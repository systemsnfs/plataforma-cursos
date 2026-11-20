const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { detectSessionInUrl: true } });
const form = document.getElementById("resetForm");
const message = document.getElementById("message");
let recoveryAuthorized = false;
function allowRecovery() { recoveryAuthorized = true; form.hidden = false; message.textContent = ""; }
sb.auth.onAuthStateChange((event) => {
 if (event === "PASSWORD_RECOVERY") allowRecovery();
});
(async () => {
 message.textContent = "Verificando link de recuperação...";
 try {
  const query = new URLSearchParams(location.search);
  const hash = new URLSearchParams(location.hash.slice(1));
  if (query.get("error") || hash.get("error")) throw new Error("invalid_link");
  if (query.get("token_hash") && query.get("type") === "recovery") {
   const { error } = await sb.auth.verifyOtp({ token_hash: query.get("token_hash"), type: "recovery" });
   if (error) throw error;
   history.replaceState({}, "", location.pathname);
   allowRecovery();
   return;
  }
  if (hash.get("type") === "recovery" && hash.get("access_token")) {
   const { error } = await sb.auth.setSession({ access_token: hash.get("access_token"), refresh_token: hash.get("refresh_token") || "" });
   if (error) throw error;
   history.replaceState({}, "", location.pathname);
   allowRecovery();
   return;
  }
  await new Promise(resolve => setTimeout(resolve, 700));
  if (!recoveryAuthorized) throw new Error("invalid_link");
 } catch (error) {
  console.error("Link de recuperação inválido:", error);
  form.hidden = true;
  message.textContent = "Link inválido ou expirado. Solicite um novo em Esqueci minha senha.";
 }
})();
form.addEventListener("submit", async event => {
 event.preventDefault();
 if (!recoveryAuthorized) return;
 const password = document.getElementById("password").value;
 const confirm = document.getElementById("confirmPassword").value;
 if (password.length < 8) { message.textContent = "Use pelo menos 8 caracteres."; return; }
 if (password !== confirm) { message.textContent = "As senhas não coincidem."; return; }
 const button = form.querySelector("button"); button.disabled = true;
 message.textContent = "Salvando nova senha...";
 try {
  const { error } = await sb.auth.updateUser({ password });
  if (error) throw error;
  await sb.auth.signOut();
  form.hidden = true;
  message.innerHTML = 'Senha atualizada com sucesso! <a href="login.html">Entrar na minha conta</a>';
 } catch (error) {
  console.error("Erro ao atualizar senha:", error);
  message.textContent = "Não foi possível atualizar a senha. Solicite um novo link e tente novamente.";
 } finally { button.disabled = false; }
});
