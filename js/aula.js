const sb2 = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const box =
  document.getElementById("lesson");


async function initLesson() {

  /* =====================================
     USUÁRIO
  ===================================== */

  const {
    data: { user },
    error: userError
  } = await sb2.auth.getUser();


  if (userError || !user) {

    location.href = "login.html";

    return;
  }


  const lessonId = (
    new URLSearchParams(
      location.search
    ).get("id") || ""
  ).trim();


  if (!lessonId) {

    showError(
      "Aula não encontrada.",
      "Não foi possível identificar a aula."
    );

    return;
  }


  /* =====================================
     CARREGAR AULA
  ===================================== */

  const {
    data: lesson,
    error: lessonError
  } = await sb2
    .from("lessons")
    .select(`
      *,
      modules(
        id,
        title,
        course_id,
        position
      )
    `)
    .eq("id", lessonId)
    .single();


  if (
    lessonError ||
    !lesson ||
    !lesson.modules
  ) {

    showError(
      "Aula indisponível.",
      "Esta aula não foi encontrada."
    );

    return;
  }


  /* =====================================
     BLOQUEAR RASCUNHO
  ===================================== */

  if (lesson.published !== true) {

    showError(
      "Aula indisponível.",
      "Esta aula ainda não foi publicada."
    );

    return;
  }


  const courseId =
    lesson.modules.course_id;


  /* =====================================
     VALIDAR MATRÍCULA DESTE CURSO
  ===================================== */

  const {
    data: enrollment,
    error: enrollmentError
  } = await sb2
    .from("enrollments")
    .select("id, course_id, status")
    .eq("user_id", user.id)
    .eq("course_id", courseId)
    .eq("status", "active")
    .maybeSingle();


  if (
    enrollmentError ||
    !enrollment
  ) {

    showError(
      "Acesso não liberado.",
      "Você não possui matrícula ativa para este curso."
    );

    return;
  }


  /* =====================================
     CARREGAR CURSO
  ===================================== */

  const {
    data: course
  } = await sb2
    .from("courses")
    .select("id, title")
    .eq("id", courseId)
    .maybeSingle();


  /* =====================================
     TODAS AS AULAS PUBLICADAS
  ===================================== */

  const {
    data: modules,
    error: modulesError
  } = await sb2
    .from("modules")
    .select(`
      id,
      title,
      position,
      lessons(
        id,
        title,
        position,
        published
      )
    `)
    .eq("course_id", courseId)
    .order(
      "position",
      { ascending: true }
    );


  if (modulesError) {

    console.error(
      "Erro ao carregar aulas:",
      modulesError
    );
  }


  /* =====================================
     ORGANIZAR NAVEGAÇÃO
  ===================================== */

  const allLessons = [];


  [...(modules || [])]
    .sort(
      (a, b) =>
        (a.position || 0) -
        (b.position || 0)
    )
    .forEach(module => {

      const publishedLessons =
        [...(module.lessons || [])]

          .filter(
            item =>
              item.published === true
          )

          .sort(
            (a, b) =>
              (a.position || 0) -
              (b.position || 0)
          );


      publishedLessons.forEach(
        item => {

          allLessons.push({

            ...item,

            module_title:
              module.title

          });

        }
      );

    });


  const currentIndex =
    allLessons.findIndex(
      item =>
        item.id === lesson.id
    );


  const previousLesson =
    currentIndex > 0
      ? allLessons[currentIndex - 1]
      : null;


  const nextLesson =
    currentIndex >= 0 &&
    currentIndex < allLessons.length - 1
      ? allLessons[currentIndex + 1]
      : null;


  const lessonPosition =
    currentIndex >= 0
      ? currentIndex + 1
      : 1;


  const totalLessons =
    allLessons.length;


  /* =====================================
     MATERIAL
  ===================================== */

  const materialButton =
    lesson.material_url
      ? `
        <a
          class="premium-material-btn"
          href="${escapeAttr(
            lesson.material_url
          )}"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span class="material-icon">
            ↓
          </span>

          Material da aula
        </a>
      `
      : "";


  /* =====================================
     MOSTRAR AULA
  ===================================== */

  box.innerHTML = `

    <div class="premium-lesson-header">

      <div class="premium-lesson-breadcrumb">

        <span>
          ${escapeHtml(
            course?.title ||
            "Meu curso"
          )}
        </span>

        <span class="breadcrumb-separator">
          /
        </span>

        <span>
          ${escapeHtml(
            lesson.modules.title
          )}
        </span>

      </div>


      <div class="premium-lesson-title-row">

        <div>

          <span class="premium-eyebrow">
            ${
              escapeHtml(
                lesson.modules.title
              )
            }
          </span>

          <h1>
            ${escapeHtml(
              lesson.title
            )}
          </h1>

        </div>


        <div class="premium-lesson-position">

          <strong>
            ${lessonPosition}
          </strong>

          <span>
            de ${totalLessons}
          </span>

        </div>

      </div>


      ${
        lesson.description
          ? `
            <p class="premium-lesson-description">
              ${escapeHtml(
                lesson.description
              )}
            </p>
          `
          : ""
      }

    </div>


    <!-- CONTEÚDO DA AULA -->

${
  lesson.video_url
    ? `
        <div class="premium-video-card">

          <div class="premium-video">

            <iframe
              src="${escapeAttr(lesson.video_url)}"
              title="${escapeAttr(lesson.title)}"
              allow="
                accelerometer;
                autoplay;
                clipboard-write;
                encrypted-media;
                gyroscope;
                picture-in-picture
              "
              allowfullscreen
            ></iframe>

          </div>


          ${
            lesson.material_url
              ? `
                  <div class="premium-video-footer">

                    <div>

                      <span class="premium-eyebrow">
                        MATERIAL
                      </span>

                      <strong>
                        Conteúdo complementar
                      </strong>

                    </div>

                    ${materialButton}

                  </div>
                `
              : ""
          }

        </div>
      `
    : lesson.material_url
      ? `
          <div class="premium-material-only">

            <div>

              <span class="premium-eyebrow">
                MATERIAL DA AULA
              </span>

              <h2>
                Conteúdo complementar
              </h2>

              <p>
                Acesse o material disponibilizado
                para esta aula.
              </p>

            </div>

            ${materialButton}

          </div>
        `
      : ""
}
    <!-- FÓRUM DE DISCUSSÃO DA AULA -->
    <section class="legion-discussion" id="lessonDiscussion" aria-labelledby="discussionHeading">
      <div class="legion-discussion-header">
        <div>
          <span class="premium-eyebrow">COMUNIDADE DE ALUNOS</span>
          <h2 id="discussionHeading">Discussão da aula</h2>
          <p>Compartilhe dúvidas e experiências sobre o conteúdo desta aula.</p>
        </div>
        <span id="discussionCount" class="legion-discussion-count">Carregando...</span>
      </div>
      <div id="discussionList" class="legion-discussion-list" aria-live="polite"></div>
      <form id="discussionForm" class="legion-discussion-form">
        <label for="discussionMessage">Participar da discussão</label>
        <div id="discussionReplyInfo" class="legion-discussion-reply-info" hidden>
          <span></span>
          <button type="button" id="discussionCancelReply">Cancelar resposta</button>
        </div>
        <textarea id="discussionMessage" rows="3" maxlength="2000" minlength="3" required placeholder="Escreva uma dúvida ou compartilhe uma experiência..."></textarea>
        <div class="legion-discussion-form-footer">
          <small>Seja respeitoso. As mensagens ficam visíveis imediatamente aos demais alunos.</small>
          <button type="submit" id="discussionSend">Publicar comentário →</button>
        </div>
      </form>
      <div id="discussionStatus" role="status" aria-live="polite"></div>
    </section>

    <!-- NAVEGAÇÃO -->

    <div class="premium-lesson-navigation">

      <a
        href="aluno.html"
        class="premium-back-course"
      >
        <span>←</span>

        Voltar para o curso
      </a>


      <div class="premium-page-navigation">

        ${
          previousLesson
            ? `
              <a
                href="aula.html?id=${encodeURIComponent(
                  previousLesson.id
                )}"
                class="
                  premium-nav-btn
                  premium-nav-secondary
                "
              >
                <span>←</span>

                <div>
                  <small>
                    ANTERIOR
                  </small>

                  <strong>
                    ${escapeHtml(
                      previousLesson.title
                    )}
                  </strong>
                </div>
              </a>
            `
            : `
              <button
                type="button"
                class="
                  premium-nav-btn
                  premium-nav-secondary
                "
                disabled
              >
                <span>←</span>

                <div>
                  <small>
                    ANTERIOR
                  </small>

                  <strong>
                    Primeira aula
                  </strong>
                </div>
              </button>
            `
        }


        ${
          nextLesson
            ? `
              <a
                href="aula.html?id=${encodeURIComponent(
                  nextLesson.id
                )}"
                class="
                  premium-nav-btn
                  premium-nav-next
                "
              >

                <div>
                  <small>
                    PRÓXIMA
                  </small>

                  <strong>
                    ${escapeHtml(
                      nextLesson.title
                    )}
                  </strong>
                </div>

                <span>→</span>

              </a>
            `
            : `
              <button
                type="button"
                class="
                  premium-nav-btn
                  premium-nav-next
                "
                disabled
              >

                <div>
                  <small>
                    CURSO
                  </small>

                  <strong>
                    Fim do curso
                  </strong>
                </div>

                <span>✓</span>

              </button>
            `
        }

      </div>

    </div>


    <div
      id="lessonMsg"
      class="message"
    ></div>

  `;
  // Exibe nas aulas o mesmo fundo configurado pelo ADM para a área do aluno.
  void applyLessonBannerBackground();
  await initLessonDiscussion(lesson.id);
}


/* =====================================
   FUNDO DO CABEÇALHO DA AULA
   Sincronizado com a área do aluno
===================================== */
async function applyLessonBannerBackground() {
  const banner = box.querySelector(".premium-lesson-header");
  if (!banner) return;

  try {
    const { data, error } = await sb2
      .from("homepage_media")
      .select("background_image_path")
      .eq("id", 1)
      .single();
    if (error) throw error;

    const path = data?.background_image_path;
    if (!path || !/^homepage\\/hero-[0-9a-f-]{36}\\.(jpg|jpeg|png|webp)$/.test(path)) return;

    const publicUrl = sb2.storage.from("materiais").getPublicUrl(path).data.publicUrl;
    const imageUrl = new URL(publicUrl);
    if (imageUrl.protocol !== "https:") return;

    // A camada escura mantém título, descrição e progresso legíveis.
    banner.style.setProperty(
      "background-image",
      "linear-gradient(90deg,rgba(14,30,21,.94) 0%,rgba(19,37,27,.75) 48%,rgba(18,34,25,.31) 100%),url('" + imageUrl.href + "')",
      "important"
    );
    banner.style.setProperty("background-size", "cover", "important");
    banner.style.setProperty("background-position", "center 35%", "important");
    banner.style.setProperty("background-repeat", "no-repeat", "important");
  } catch (error) {
    console.warn("Não foi possível carregar o fundo da área do aluno na aula:", error);
  }
}

/* =====================================
   ERROS
===================================== */

function showError(
  title,
  description
) {

  box.innerHTML = `

    <div class="premium-lesson-error">

      <div class="premium-error-icon">
        ◇
      </div>

      <h1>
        ${escapeHtml(title)}
      </h1>

      <p>
        ${escapeHtml(description)}
      </p>

      <a
        href="aluno.html"
        class="premium-error-back"
      >
        ← Voltar para meus cursos
      </a>

    </div>

  `;
}


/* =====================================
   LOGOUT
===================================== */

document
  .getElementById("logout")
  .onclick =
  async () => {

    await sb2.auth.signOut();

    location.href =
      "index.html";

  };


/* =====================================
   SEGURANÇA
===================================== */

function escapeHtml(value) {

  return String(
    value ?? ""
  ).replace(
    /[&<>"']/g,
    character => ({

      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"

    }[character])
  );
}


function escapeAttr(value) {

  return escapeHtml(value);
}


initLesson();
