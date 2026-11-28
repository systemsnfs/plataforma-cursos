const adminSb = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const $ = selector =>
  document.querySelector(selector);

const message = $("#message");

const editCourseModal =
  $("#editCourseModal");

const editCourseForm =
  $("#editCourseForm");


async function init() {

  const {
    data: { user },
    error: userError
  } = await adminSb.auth.getUser();

  if (userError || !user) {
    location.href = "login.html";
    return;
  }

  const {
    data: profile,
    error: profileError
  } = await adminSb
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (
    profileError ||
    !profile ||
    profile.role !== "admin"
  ) {

    document.body.innerHTML = `
      <main class="auth-page">

        <div class="auth-box">

          <h1>Acesso negado</h1>

          <p>
            Esta área é exclusiva
            para administradores.
          </p>

        </div>

      </main>
    `;

    return;
  }

  await load();
}


async function load() {

  const coursesResult =
    await adminSb
      .from("courses")
      .select("*")
      .order(
        "created_at",
        { ascending: false }
      );

  const studentsResult =
    await adminSb
      .from("profiles")
      .select(
        "id, full_name, role, active, created_at"
      )
      .eq("role", "student")
      .order(
        "created_at",
        { ascending: false }
      );

  const enrollmentsResult =
    await adminSb
      .from("enrollments")
      .select("id, user_id, course_id, status");


  if (coursesResult.error) {
    message.textContent =
      coursesResult.error.message;

    return;
  }

  if (studentsResult.error) {
    message.textContent =
      studentsResult.error.message;

    return;
  }

  if (enrollmentsResult.error) {
    message.textContent =
      enrollmentsResult.error.message;

    return;
  }


  let payments = [];
  if ($("#students")) {
    const paymentsResult = await adminSb
      .from("payments")
      .select("user_id, course_id, status, telegram_addon");
    if (paymentsResult.error) {
      message.textContent = "Não foi possível consultar os acessos do Telegram: " + paymentsResult.error.message;
      return;
    }
    payments = paymentsResult.data || [];
  }

  let telegramOverrides = [];
  if ($("#students")) {
    const overridesResult = await adminSb.from("telegram_access_overrides").select("user_id, allowed");
    if (overridesResult.error) {
      message.textContent = "Não foi possível consultar permissões do Telegram: " + overridesResult.error.message;
      return;
    }
    telegramOverrides = overridesResult.data || [];
  }

  renderStats(
    coursesResult.data || [],
    studentsResult.data || [],
    enrollmentsResult.data || []
  );

  renderCourses(
    coursesResult.data || []
  );

  renderStudents(
    studentsResult.data || [],
    coursesResult.data || [],
    enrollmentsResult.data || [],
    payments,
    telegramOverrides
  );

  addCourseButtons();
}


function renderStats(
  courses,
  students,
  enrollments
) {

  const stats = $("#stats");

  if (!stats) return;

  const activeEnrollments =
    enrollments.filter(
      item => item.status === "active"
    ).length;


  stats.innerHTML = `

    <article class="premium-stat-card">

      <div class="stat-icon">
        ◫
      </div>

      <div class="stat-content">

        <span class="stat-label">
          Cursos
        </span>

        <strong class="stat-number">
          ${courses.length}
        </strong>

        <small>
          ${
            courses.length === 1
              ? "Curso cadastrado"
              : "Cursos cadastrados"
          }
        </small>

      </div>

    </article>


    <article class="premium-stat-card">

      <div class="stat-icon">
        ♙
      </div>

      <div class="stat-content">

        <span class="stat-label">
          Alunos
        </span>

        <strong class="stat-number">
          ${students.length}
        </strong>

        <small>
          ${
            students.length === 1
              ? "Aluno cadastrado"
              : "Alunos cadastrados"
          }
        </small>

      </div>

    </article>


    <article class="premium-stat-card">

      <div class="stat-icon">
        ◇
      </div>

      <div class="stat-content">

        <span class="stat-label">
          Matrículas
        </span>

        <strong class="stat-number">
          ${activeEnrollments}
        </strong>

        <small>
          ${
            activeEnrollments === 1
              ? "Acesso ativo"
              : "Acessos ativos"
          }
        </small>

      </div>

    </article>

  `;
}

let allAdminCourses = [];
const formatCoursePrice = price => Number(price || 0).toLocaleString("pt-BR", {style:"currency",currency:"BRL"});

function renderCourses(coursesData) {
  const list = $("#courses");
  if (!list) return;
  allAdminCourses = coursesData || [];
  const total = allAdminCourses.length;
  const active = allAdminCourses.filter(c => c.active === true).length;
  if ($("#coursesTotal")) $("#coursesTotal").textContent = total;
  if ($("#coursesActive")) $("#coursesActive").textContent = active;
  if ($("#coursesInactive")) $("#coursesInactive").textContent = total - active;

  const term = ($("#courseSearch")?.value || "").trim().toLocaleLowerCase("pt-BR");
  const status = $("#courseStatusFilter")?.value || "all";
  const visible = allAdminCourses.filter(c => {
    const matchesText = !term || `${c.title || ""} ${c.slug || ""}`.toLocaleLowerCase("pt-BR").includes(term);
    const matchesStatus = status === "all" || (status === "active" ? c.active === true : c.active !== true);
    return matchesText && matchesStatus;
  });
  if ($("#coursesCount")) $("#coursesCount").textContent = `${visible.length} de ${total} ${total === 1 ? "curso" : "cursos"}`;
  if (!visible.length) {
    list.innerHTML = `<div class="legion-course-empty"><strong>${total ? "Nenhum curso encontrado" : "Nenhum curso cadastrado"}</strong><p>${total ? "Altere a busca ou o filtro para ver outros cursos." : "Clique em + Novo curso para criar seu primeiro treinamento."}</p></div>`;
    return;
  }

  list.innerHTML = visible.map(c => `
    <article class="premium-course-card legion-course-row">
      <div class="course-card-icon legion-course-row-icon" aria-hidden="true">◇</div>
      <div class="course-card-info legion-course-row-main">
        <span class="course-card-label">TREINAMENTO</span>
        <h3>${escapeHtml(c.title || "Curso sem nome")}</h3>
        <div class="legion-course-row-meta">
          <span>${escapeHtml(c.slug || "Sem identificador")}</span>
          <span class="legion-course-price">${formatCoursePrice(c.price)}</span>
          <span class="legion-course-status ${c.active ? "is-active" : "is-inactive"}">${c.active ? "Ativo" : "Inativo"}</span>
        </div>
      </div>
      <div class="course-card-actions legion-course-actions">
        <button type="button" class="btn course-edit-btn edit-course" data-id="${c.id}">Editar</button>
        <a class="btn course-content-btn" href="admin-curso.html?id=${encodeURIComponent(c.id)}">Conteúdo</a>
        <button type="button" class="btn legion-course-toggle" data-id="${c.id}" data-active="${c.active === true}" title="${c.active ? "Ocultar este curso do catálogo público" : "Publicar este curso no catálogo público"}">${c.active ? "Desativar" : "Ativar"}</button>
        <button type="button" class="btn course-delete-btn delete-course" data-id="${c.id}" data-title="${escapeHtml(c.title || "Curso")}" title="Excluir permanentemente">Excluir</button>
      </div>
    </article>
  `).join("");
  addCourseButtons();
}

$("#courseSearch")?.addEventListener("input", () => renderCourses(allAdminCourses));
$("#courseStatusFilter")?.addEventListener("change", () => renderCourses(allAdminCourses));

function hasStudentTelegramAccess(student, enrollments, payments, overrides = []) {
  if (!student.active) return false;
  const manual = overrides.find(entry => entry.user_id === student.id);
  if (manual) return manual.allowed === true;
  const activeIds = new Set(
    enrollments.filter(e => e.user_id === student.id && e.status === "active").map(e => e.course_id)
  );
  return payments.some(p => p.user_id === student.id &&
    p.status === "approved" && p.telegram_addon === true && activeIds.has(p.course_id));
}

function renderStudents(studentsData, coursesData = [], enrollmentsData = [], paymentsData = [], overrideData = []) {

  const students = $("#students");

  if (!students) return;

  if (!studentsData.length) {

    students.innerHTML = `
      <div class="premium-empty">

        <div class="premium-empty-icon">
          ♙
        </div>

        <strong>
          Nenhum aluno cadastrado
        </strong>

        <span>
          Os alunos aparecerão aqui.
        </span>

      </div>
    `;

    return;
  }


  students.innerHTML =
    studentsData
      .map(student => {

        const name =
          student.full_name ||
          "Sem nome";

        const initial =
          name
            .trim()
            .charAt(0)
            .toUpperCase() || "A";

        const activeEnrollments = enrollmentsData.filter(enrollment =>
          enrollment.user_id === student.id && enrollment.status === "active"
        );
        const accessibleTitles = activeEnrollments.map(enrollment =>
          coursesData.find(course => course.id === enrollment.course_id)?.title || "Curso indisponível"
        );
        const telegramApproved = hasStudentTelegramAccess(student, enrollmentsData, paymentsData, overrideData);


        return `

          <div class="premium-student-card">

            <div class="student-main">

              <div class="student-avatar">
                ${escapeHtml(initial)}
              </div>


              <div class="student-info">

                <strong>
                  ${escapeHtml(name)}
                </strong>

                <div class="
                  student-status
                  ${
                    student.active
                      ? "status-active"
                      : "status-inactive"
                  }
                ">

                  <span class="status-dot"></span>

                  ${
                    student.active
                      ? "Usuário ativo"
                      : "Usuário inativo"
                  }

                </div>

                <div class="legion-student-access-summary">
                  <span class="legion-student-access-label">CURSOS COM ACESSO</span>
                  <div class="legion-student-access-tags">
                    ${accessibleTitles.length
                      ? accessibleTitles.map(title => `<span class="legion-student-course-tag">${escapeHtml(title)}</span>`).join("")
                      : '<span class="legion-student-no-access">Nenhum curso liberado</span>'}
                  </div>
                  <span class="legion-student-telegram-status ${telegramApproved ? "has-access" : "no-access"}">
                    <span aria-hidden="true">✈</span>
                    Telegram: ${telegramApproved ? "Acesso liberado" : "Sem acesso"}
                  </span>
                </div>

              </div>

            </div>


            <div class="student-actions">

              <button
                type="button"
                class="btn student-status-btn"
                onclick="
                  toggleStudent(
                    '${student.id}',
                    ${student.active}
                  )
                "
              >
                ${
                  student.active
                    ? "Desativar"
                    : "Ativar"
                }
              </button>


              <button
                type="button"
                class="btn student-access-btn"
                onclick="
                  manageAccess(
                    '${student.id}'
                  )
                "
              >
                Acessos
              </button>

              <button
                type="button"
                class="btn student-delete-btn"
                onclick="deleteStudent('${student.id}')"
                title="Excluir permanentemente este aluno"
              >
                Excluir aluno
              </button>

            </div>

          </div>

        `;

      })
      .join("");
}
function addCourseButtons() {

  document
    .querySelectorAll(
      ".edit-course"
    )
    .forEach(button => {

      button.onclick =
        async () => {

          await openEditCourse(
            button.dataset.id
          );

        };

    });


  document
    .querySelectorAll(
      ".delete-course"
    )
    .forEach(button => {

      button.onclick =
        async () => {

          await deleteCourse(
            button.dataset.id,
            button.dataset.title
          );

        };

    });
  document.querySelectorAll(".legion-course-toggle").forEach(button => {
    button.onclick = async () => {
      const id = button.dataset.id;
      const nextActive = button.dataset.active !== "true";
      if (!confirm(nextActive
          ? "Ativar este curso e exibi-lo no catálogo público?"
          : "Desativar este curso e ocultá-lo do catálogo público? Os acessos de alunos já matriculados serão preservados.")) return;
      button.disabled = true;
      const { error } = await adminSb.from("courses").update({active:nextActive}).eq("id",id);
      if (error) {
        alert("Não foi possível atualizar o curso: " + error.message);
        button.disabled = false;
        return;
      }
      if (message) message.textContent = nextActive ? "Curso ativado com sucesso." : "Curso desativado com sucesso.";
      await load();
    };
  });

}


/* ========================
   MODAL DE CADASTRO DE CURSO
======================== */
const newCourseModal = $("#newCourseModal");
const closeNewCourseModal = () => {
  if (!newCourseModal) return;
  newCourseModal.style.display = "none";
  document.body.classList.remove("legion-modal-open");
};
$("#openNewCourse")?.addEventListener("click", () => {
  if (!newCourseModal) return;
  newCourseModal.style.display = "flex";
  document.body.classList.add("legion-modal-open");
  $("#title")?.focus();
});
$("#closeNewCourse")?.addEventListener("click", closeNewCourseModal);
newCourseModal?.addEventListener("click", e => {
  if (e.target === newCourseModal) closeNewCourseModal();
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && newCourseModal?.style.display === "flex") closeNewCourseModal();
});

/* ========================
   ABRIR MODAL EDITAR CURSO
======================== */

async function openEditCourse(
  courseId
) {

  const {
    data: course,
    error
  } = await adminSb
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .single();


  if (error || !course) {

    message.textContent =
      error?.message ||
      "Não foi possível carregar o curso.";

    return;
  }


  $("#editCourseId").value =
    course.id;

  $("#editTitle").value =
    course.title || "";

  $("#editSlug").value =
    course.slug || "";

  $("#editPrice").value =
    course.price ?? 0;

  $("#editDescription").value =
    course.description || "";

  if ($("#editActive")) $("#editActive").checked = course.active === true;


  editCourseModal.style.display =
    "flex";
}


/* ========================
   FECHAR MODAL
======================== */

function closeEditCourseModal() {

  editCourseModal.style.display =
    "none";

  editCourseForm.reset();
}


if ($("#closeEditCourse")) $("#closeEditCourse").onclick =
  closeEditCourseModal;


if ($("#cancelEditCourse")) $("#cancelEditCourse").onclick =
  closeEditCourseModal;


if (editCourseModal) editCourseModal.onclick =
  event => {

    if (
      event.target ===
      editCourseModal
    ) {

      closeEditCourseModal();

    }

  };


/* ========================
   SALVAR EDIÇÃO
======================== */

editCourseForm?.addEventListener(
  "submit",
  async event => {

    event.preventDefault();


    const courseId =
      $("#editCourseId").value;


    const title =
      $("#editTitle")
        .value
        .trim();


    const slug =
      $("#editSlug")
        .value
        .trim();


    const price =
      Number(
        $("#editPrice")
          .value || 0
      );


    const description =
      $("#editDescription")
        .value
        .trim();


    if (!title) {

      alert(
        "Informe o nome do curso."
      );

      return;
    }


    if (!slug) {

      alert(
        "Informe o slug."
      );

      return;
    }


    const {
      error
    } = await adminSb
      .from("courses")
      .update({

        title,
        slug,
        price,
        description,
        active: $("#editActive")?.checked === true

      })
      .eq("id", courseId);


    if (error) {

      alert(
        "Erro ao salvar: " +
        error.message
      );

      return;
    }


    closeEditCourseModal();


    message.textContent =
      "Curso atualizado com sucesso!";


    await load();
  }
);


/* ========================
   EXCLUIR CURSO
======================== */

async function deleteCourse(
  courseId,
  courseTitle
) {

  const confirmed =
    confirm(
      `Tem certeza que deseja excluir o curso "${courseTitle}"?`
    );


  if (!confirmed) return;


  message.textContent =
    "Excluindo curso...";


  const {
    data: modules,
    error: modulesError
  } = await adminSb
    .from("modules")
    .select("id")
    .eq("course_id", courseId);


  if (modulesError) {

    message.textContent =
      modulesError.message;

    return;
  }


  const moduleIds =
    (modules || [])
      .map(module => module.id);


  if (moduleIds.length) {

    const {
      data: lessons,
      error: lessonsError
    } = await adminSb
      .from("lessons")
      .select("id")
      .in(
        "module_id",
        moduleIds
      );


    if (lessonsError) {

      message.textContent =
        lessonsError.message;

      return;
    }


    const lessonIds =
      (lessons || [])
        .map(lesson => lesson.id);


    if (lessonIds.length) {

      const {
        error: progressError
      } = await adminSb
        .from("lesson_progress")
        .delete()
        .in(
          "lesson_id",
          lessonIds
        );


      if (progressError) {

        message.textContent =
          progressError.message;

        return;
      }


      const {
        error: lessonsDeleteError
      } = await adminSb
        .from("lessons")
        .delete()
        .in(
          "id",
          lessonIds
        );


      if (lessonsDeleteError) {

        message.textContent =
          lessonsDeleteError.message;

        return;
      }
    }


    const {
      error: modulesDeleteError
    } = await adminSb
      .from("modules")
      .delete()
      .in(
        "id",
        moduleIds
      );


    if (modulesDeleteError) {

      message.textContent =
        modulesDeleteError.message;

      return;
    }
  }


  const {
    error: enrollmentError
  } = await adminSb
    .from("enrollments")
    .delete()
    .eq(
      "course_id",
      courseId
    );


  if (enrollmentError) {

    message.textContent =
      enrollmentError.message;

    return;
  }


  const {
    error: courseError
  } = await adminSb
    .from("courses")
    .delete()
    .eq(
      "id",
      courseId
    );


  if (courseError) {

    message.textContent =
      courseError.message;

    return;
  }


  message.textContent =
    "Curso excluído com sucesso!";


  await load();
}


/* ========================
   CADASTRAR CURSO
======================== */

const courseForm =
  $("#courseForm");


courseForm?.addEventListener(
  "submit",
  async event => {

    event.preventDefault();


    const title =
      $("#title")
        .value
        .trim();


    const slug =
      $("#slug")
        .value
        .trim();


    const price =
      Number(
        $("#price")
          .value || 0
      );


    const description =
      $("#description")
        .value
        .trim();


    if (!title) {

      message.textContent =
        "Informe o nome do curso.";

      return;
    }


    if (!slug) {

      message.textContent =
        "Informe o slug.";

      return;
    }


    message.textContent =
      "Cadastrando curso...";


    const {
      error
    } = await adminSb
      .from("courses")
      .insert({

        title,
        slug,
        price,
        description,
        active: $("#createActive")?.checked === true

      });


    if (error) {

      message.textContent =
        error.message;

      return;
    }


    message.textContent =
      "Curso cadastrado com sucesso!";


    courseForm.reset();
    closeNewCourseModal();


    await load();
  }
);


/* ========================
   ATIVAR / DESATIVAR ALUNO
======================== */

window.toggleStudent =
async function(
  studentId,
  currentStatus
) {

  const action =
    currentStatus
      ? "desativar"
      : "ativar";


  const confirmed =
    confirm(
      `Deseja realmente ${action} este aluno?`
    );


  if (!confirmed) return;


  const {
    error
  } = await adminSb
    .from("profiles")
    .update({

      active:
        !currentStatus

    })
    .eq(
      "id",
      studentId
    );


  if (error) {

    alert(
      "Erro: " +
      error.message
    );

    return;
  }


  await load();
};


/* ========================
   EXCLUIR ALUNO
   Apenas administradores; exclusão executada de forma segura no servidor
======================== */

window.deleteStudent = async function(studentId) {
  const { data: student, error: studentError } = await adminSb
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", studentId)
    .maybeSingle();

  if (studentError || !student || student.role !== "student") {
    alert(studentError?.message || "Aluno não encontrado.");
    return;
  }

  const name = student.full_name || "este aluno";
  const confirmed = confirm(
    `Excluir permanentemente "${name}"?\n\nA conta de login e os acessos aos cursos serão removidos. Esta ação não pode ser desfeita. Os registros financeiros serão preservados.`
  );
  if (!confirmed) return;

  const finalConfirmation = confirm(
    `Confirme a exclusão definitiva de "${name}". Deseja continuar?`
  );
  if (!finalConfirmation) return;

  message.textContent = `Excluindo aluno "${name}"...`;

  const { data: { session }, error: sessionError } = await adminSb.auth.getSession();
  if (sessionError || !session?.access_token) {
    message.textContent = "Sua sessão expirou. Faça login novamente.";
    return;
  }

  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/delete-student`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ student_id: studentId })
      }
    );
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || "Não foi possível excluir o aluno.");
    }

    message.textContent = `Aluno "${name}" excluído com sucesso.`;
    await load();
  } catch (error) {
    console.error("Erro ao excluir aluno", error);
    message.textContent = error.message || "Erro ao excluir aluno.";
    alert(message.textContent);
  }
};

/* ========================
   ACESSOS DO ALUNO
======================== */

window.manageAccess = async function(studentId) {

  /* BUSCAR ALUNO */

  const {
    data: student,
    error: studentError
  } = await adminSb
    .from("profiles")
    .select("full_name, active, role")
    .eq("id", studentId)
    .single();


  if (studentError) {
    alert(studentError.message);
    return;
  }


  /* BUSCAR CURSOS */

  const {
    data: courses,
    error: coursesError
  } = await adminSb
    .from("courses")
    .select("id, title")
    .order("title");


  if (coursesError) {
    alert(coursesError.message);
    return;
  }


  /* BUSCAR ACESSOS ATUAIS */

  const {
    data: enrollments,
    error: enrollmentsError
  } = await adminSb
    .from("enrollments")
    .select("id, user_id, course_id, status")
    .eq("user_id", studentId);


  if (enrollmentsError) {
    alert(enrollmentsError.message);
    return;
  }

  const {data: telegramPayments, error: telegramPaymentsError} = await adminSb
    .from("payments")
    .select("course_id, status, telegram_addon")
    .eq("user_id", studentId)
    .eq("telegram_addon", true);
  if (telegramPaymentsError) {
    alert("Não foi possível consultar o Telegram: " + telegramPaymentsError.message);
    return;
  }
  const {data: manualOverride, error: overrideError} = await adminSb
    .from("telegram_access_overrides")
    .select("allowed")
    .eq("user_id", studentId)
    .maybeSingle();
  if (overrideError) {
    alert("Não foi possível consultar a permissão manual: " + overrideError.message);
    return;
  }
  const telegramEligible = student.role === "admin"
    ? student.active === true && manualOverride?.allowed === true
    : hasStudentTelegramAccess(
        {id:studentId, active: student.active},
        enrollments || [],
        (telegramPayments || []).map(p => ({...p, user_id:studentId})),
        manualOverride ? [{user_id:studentId, allowed:manualOverride.allowed}] : []
      );
  const telegramPurchased = (telegramPayments || []).some(p =>
    p.status === "approved" && p.telegram_addon === true
  );
  const telegramLabel = telegramEligible
    ? "Acesso liberado"
    : telegramPurchased
      ? "Adicional aprovado, mas sem acesso ativo ao curso ou à conta"
      : "Não adquirido ou pagamento não aprovado";


  const studentName =
    student?.full_name || "Aluno";


  const initial =
    studentName
      .trim()
      .charAt(0)
      .toUpperCase() || "A";


  /* CRIAR MODAL */

  const box =
    document.createElement("div");

  box.className =
    "modal access-premium-modal";


  box.innerHTML = `

    <div class="modal-content access-modal-content">

      <!-- CABEÇALHO -->

      <div class="access-modal-header">

        <div class="access-header-main">

          <div class="access-modal-icon">
            ◇
          </div>

          <div>

            <span class="premium-eyebrow">
              PERMISSÕES
            </span>

            <h2>
              Gerenciar acessos
            </h2>

            <p>
              Defina quais cursos este usuário poderá acessar.
            </p>

          </div>

        </div>


        <button
          type="button"
          id="closeAccess"
          class="modal-close"
          aria-label="Fechar"
        >
          ×
        </button>

      </div>


      <!-- ALUNO -->

      <div class="access-student">

        <div class="access-student-avatar">
          ${escapeHtml(initial)}
        </div>

        <div>

          <span>${student.role==="admin"?"ADMINISTRADOR":"ALUNO"}</span>

          <strong>
            ${escapeHtml(studentName)}
          </strong>

        </div>

      </div>


      <section class="legion-modal-telegram-status ${telegramEligible ? "is-eligible" : "is-ineligible"}">
        <div style="flex:1;min-width:0">
          <span class="legion-student-access-label">CONSULTORIA TELEGRAM</span>
          <strong id="telegramAccessText">✈ ${telegramEligible ? "Acesso liberado" : "Sem acesso"}</strong>
          <p>Libere ou bloqueie o acesso deste usuário ao Telegram. Para alunos sem alteração manual, vale a compra aprovada.</p>
          <label class="legion-telegram-admin-toggle" for="telegramAccessToggle">
            <input type="checkbox" id="telegramAccessToggle" ${telegramEligible ? "checked" : ""}>
            <span id="telegramToggleLabel">${telegramEligible ? "Permitir acesso ao Telegram" : "Dar acesso ao Telegram"}</span>
          </label>
          <small class="legion-telegram-admin-help">A escolha será aplicada ao salvar. Contas desativadas não podem abrir o grupo.</small>
        </div>
        <span class="legion-modal-telegram-marker" id="telegramAccessMarker">${telegramEligible ? "✓" : "—"}</span>
      </section>

      <!-- CURSOS -->

      <div class="access-section-title">

        <div>
          <strong>Cursos disponíveis</strong>

          <span>
            Selecione os cursos liberados para este aluno.
          </span>
        </div>

        <small>
          ${courses.length}
          ${courses.length === 1 ? "curso" : "cursos"}
        </small>

      </div>


      <div class="access-course-list">

        ${
          courses.length
            ? courses.map(course => {

                const active =
                  enrollments?.find(
                    enrollment =>
                      enrollment.course_id === course.id &&
                      enrollment.status === "active"
                  );

                return `

                  <label class="premium-access-option">

                    <div class="access-course-left">

                      <div class="access-course-icon">
                        ◫
                      </div>

                      <div class="access-course-info">

                        <strong>
                          ${escapeHtml(course.title)}
                        </strong>

                        <span>
                          ${
                            active
                              ? "Acesso liberado"
                              : "Sem acesso"
                          }
                        </span>

                      </div>

                    </div>


                    <div class="premium-checkbox">

                      <input
                        type="checkbox"
                        value="${course.id}"
                        ${active ? "checked" : ""}
                      >

                      <span class="checkmark">
                        ✓
                      </span>

                    </div>

                  </label>

                `;

              }).join("")

            : `

              <div class="access-empty">

                <div>◇</div>

                <strong>
                  Nenhum curso cadastrado
                </strong>

                <span>
                  Cadastre um curso antes de liberar acessos.
                </span>

              </div>

            `
        }

      </div>


      <!-- RODAPÉ -->

      <div class="access-modal-footer">

        <div class="access-help">

          <span>ⓘ</span>

          <p>
            As alterações serão aplicadas
            imediatamente à área do aluno.
          </p>

        </div>


        <div class="modal-actions">

          <button
            id="cancelAccess"
            type="button"
            class="btn access-cancel-btn"
          >
            Cancelar
          </button>

          <button
            id="saveAccess"
            type="button"
            class="btn premium-btn"
            
          >
            Salvar acessos
          </button>

        </div>

      </div>

    </div>

  `;


  document.body.appendChild(box);


  /* FECHAR */

  const close = () => {
    box.remove();
  };


  box
    .querySelector("#closeAccess")
    .onclick = close;


  box
    .querySelector("#cancelAccess")
    .onclick = close;


  box.onclick = event => {

    if (event.target === box) {
      close();
    }

  };


  /* ATUALIZAR TEXTO AO MARCAR */

  box
    .querySelectorAll(
      '.premium-access-option input[type="checkbox"]'
    )
    .forEach(checkbox => {

      checkbox.addEventListener(
        "change",
        () => {

          const option =
            checkbox.closest(
              ".premium-access-option"
            );

          const status =
            option.querySelector(
              ".access-course-info span"
            );


          if (checkbox.checked) {

            option.classList.add(
              "selected"
            );

            status.textContent =
              "Acesso liberado";

          } else {

            option.classList.remove(
              "selected"
            );

            status.textContent =
              "Sem acesso";

          }

        }
      );


      if (checkbox.checked) {

        checkbox
          .closest(
            ".premium-access-option"
          )
          .classList.add(
            "selected"
          );

      }

    });


  const telegramToggle = box.querySelector("#telegramAccessToggle");
  telegramToggle?.addEventListener("change", () => {
    const approved = telegramToggle.checked;
    const label = box.querySelector("#telegramToggleLabel");
    const text = box.querySelector("#telegramAccessText");
    const marker = box.querySelector("#telegramAccessMarker");
    const section = box.querySelector(".legion-modal-telegram-status");
    if (label) label.textContent = approved ? "Permitir acesso ao Telegram" : "Dar acesso ao Telegram";
    if (text) text.textContent = approved ? "✈ Acesso liberado" : "✈ Sem acesso";
    if (marker) marker.textContent = approved ? "✓" : "—";
    section?.classList.toggle("is-eligible", approved);
    section?.classList.toggle("is-ineligible", !approved);
  });

  /* SALVAR */

  const saveButton =
    box.querySelector("#saveAccess");


  if (!saveButton) return;


  saveButton.onclick = async () => {

    const checkboxes = [
      ...box.querySelectorAll(
        '.premium-access-option input[type="checkbox"]'
      )
    ];


    saveButton.disabled = true;

    saveButton.textContent =
      "Salvando...";


    for (const checkbox of checkboxes) {

      const courseId =
        checkbox.value;


      const enrollment =
        enrollments?.find(
          item =>
            item.course_id ===
            courseId
        );


      /* CURSO MARCADO */

      if (checkbox.checked) {

        if (enrollment) {

          const { error } =
            await adminSb
              .from("enrollments")
              .update({
                status: "active"
              })
              .eq(
                "id",
                enrollment.id
              );


          if (error) {

            alert(error.message);

            saveButton.disabled =
              false;

            saveButton.textContent =
              "Salvar acessos";

            return;
          }

        } else {

          const { error } =
            await adminSb
              .from("enrollments")
              .insert({

                user_id:
                  studentId,

                course_id:
                  courseId,

                status:
                  "active"

              });


          if (error) {

            alert(error.message);

            saveButton.disabled =
              false;

            saveButton.textContent =
              "Salvar acessos";

            return;
          }

        }

      }

      /* CURSO DESMARCADO */

      else if (enrollment) {

        const { error } =
          await adminSb
            .from("enrollments")
            .update({
              status: "cancelled"
            })
            .eq(
              "id",
              enrollment.id
            );


        if (error) {

          alert(error.message);

          saveButton.disabled =
            false;

          saveButton.textContent =
            "Salvar acessos";

          return;
        }

      }

    }


    const selectedTelegram = telegramToggle?.checked === true;
    // Registrar uma decisão manual só quando alterada, mantendo a regra automática da compra caso contrário.
    if (telegramToggle && selectedTelegram !== telegramEligible) {
      const { data: { user: adminUser } } = await adminSb.auth.getUser();
      const { error: telegramSaveError } = await adminSb
        .from("telegram_access_overrides")
        .upsert({
          user_id: studentId,
          allowed: selectedTelegram,
          updated_by: adminUser?.id || null,
          updated_at: new Date().toISOString()
        }, { onConflict: "user_id" });
      if (telegramSaveError) {
        alert("Cursos salvos, mas não foi possível atualizar o Telegram: " + telegramSaveError.message);
        saveButton.disabled = false;
        saveButton.textContent = "Salvar acessos";
        return;
      }
    }

    close();

    message.textContent =
      `Acessos de ${studentName} atualizados com sucesso!`;

    await load();

  };

};
/* ========================
   LOGOUT
======================== */

$("#logout").onclick =
async () => {

  await adminSb.auth.signOut();

  location.href =
    "index.html";
};


/* ========================
   SEGURANÇA HTML
======================== */

function escapeHtml(value) {

  return String(
    value ?? ""
  )
    .replace(
      /[&<>"']/g,
      char => ({

        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"

      }[char])
    );
}


init();
