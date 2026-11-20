const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const form = document.getElementById("recoverForm");
const message = document.getElementById("message");
form.addEventListener("submit", async event => {
 event.preventDefault();
 const button = form.querySelector("button"); button.disabled = true;
 message.textContent = "Enviando...";
 try {
  const email = document.getElementById("email").value.trim();
  const redirectTo = new URL("nova-senha.html", location.href).href;
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
  message.textContent = "Se existir uma conta com esse e-mail, você receberá um link para redefinir sua senha. Confira também o spam.";
 } catch (error) {
  console.error("Falha ao solicitar recuperação:", error);
  message.textContent = "Não foi possível enviar o link agora. Tente novamente mais tarde.";
 } finally { button.disabled = false; }
});
