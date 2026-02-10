const { useEffect, useState } = React;

const config = window.CLIENT_CONFIG;
if (!config || !config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
  document.getElementById("root").innerHTML =
    "<div class='container'><div class='card'>يرجى إنشاء ملف config.js وتعبئة SUPABASE_URL و SUPABASE_ANON_KEY</div></div>";
}
if (!window.supabase) {
  document.getElementById("root").innerHTML =
    "<div class='container'><div class='card'>تعذر تحميل مكتبة Supabase. تأكد من اتصال الإنترنت.</div></div>";
}
const supabase = window.supabase
  ? window.supabase.createClient(
      config?.SUPABASE_URL,
      config?.SUPABASE_ANON_KEY
    )
  : null;

let _itemId = 0;
const emptyItem = () => ({
  _key: ++_itemId,
  title: "",
  body: "",
  image_url: "",
  link_url: "",
});

function App() {
  const [session, setSession] = useState(null);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authMessage, setAuthMessage] = useState(null);
  const [client, setClient] = useState(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [section1, setSection1] = useState(emptyItem());
  const [links, setLinks] = useState([emptyItem()]);
  const [offers, setOffers] = useState([emptyItem()]);
  const [userItems, setUserItems] = useState([emptyItem()]);

  if (!supabase) {
    return (
      <div className="container">
        <div className="card">تعذر تشغيل البوابة حالياً.</div>
      </div>
    );
  }


  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      supabase.auth
        .exchangeCodeForSession(code)
        .then(({ error }) => {
          if (error) {
            setAuthMessage({ type: "error", text: error.message });
          }
        })
        .finally(() => {
          const cleanUrl = new URL(
            window.location.pathname,
            window.location.origin
          );
          window.history.replaceState({}, document.title, cleanUrl);
        });
    }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) =>
      setSession(session)
    );
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      loadClientProfile();
      loadUserSections();
    }
  }, [session]);

  async function signIn() {
    setAuthBusy(true);
    setAuthMessage(null);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setAuthBusy(false);
    if (error) {
      setAuthMessage({ type: "error", text: error.message });
    }
  }

  async function signUp() {
    setAuthBusy(true);
    setAuthMessage(null);
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    setAuthBusy(false);
    if (error) {
      setAuthMessage({ type: "error", text: error.message });
      return;
    }
    setAuthMessage({
      type: "success",
      text: "تم إنشاء الحساب. تفقد بريدك لتأكيد التسجيل إن كان مطلوباً.",
    });
  }

  async function signInWithGoogle() {
    setAuthBusy(true);
    setAuthMessage(null);
    const redirectTo =
      config?.WEB_CLIENT_URL ||
      `${window.location.origin}${window.location.pathname}`;
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, skipBrowserRedirect: true },
    });
    setAuthBusy(false);
    if (error) {
      setAuthMessage({ type: "error", text: error.message });
      return;
    }
    if (data?.url) {
      window.location.href = data.url;
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setClient(null);
    setUserItems([emptyItem()]);
  }

  async function loadClientProfile() {
    const { data, error } = await supabase
      .from("client_users")
      .select("client_id, clients (id, name, slug, logo_url)")
      .single();
    if (!error && data?.clients) {
      setClient(data.clients);
      loadContent(data.clients);
    } else {
      setClient(null);
    }
  }

  async function loadContent(clientInfo) {
    const { data, error } = await supabase
      .from("client_sections")
      .select("*")
      .eq("client_slug", clientInfo.slug)
      .order("sort_order", { ascending: true });
    if (error) {
      alert(error.message);
      return;
    }
    const grouped = groupBySection(data || []);
    setSection1(grouped[1]?.[0] || emptyItem());
    setLinks(grouped[2] || [emptyItem()]);
    setOffers(grouped[3] || [emptyItem()]);
  }

  async function loadUserSections() {
    const userId = session?.user?.id;
    if (!userId) return;
    const { data, error } = await supabase
      .from("app_user_sections")
      .select("*")
      .eq("user_id", userId)
      .order("sort_order", { ascending: true });
    if (error) {
      alert(error.message);
      return;
    }
    setUserItems((data || []).length ? data : [emptyItem()]);
  }

  async function uploadImage(file) {
    if (!client) return "";
    const ext = file.name.split(".").pop();
    const path = `${client.slug}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from(config.BUCKET)
      .upload(path, file, { upsert: true });
    if (error) {
      alert(error.message);
      return "";
    }
    const { data } = supabase.storage
      .from(config.BUCKET)
      .getPublicUrl(path);
    return data.publicUrl;
  }

  async function uploadUserImage(file) {
    const userId = session?.user?.id;
    if (!userId) return "";
    const ext = file.name.split(".").pop();
    const path = `app-users/${userId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from(config.BUCKET)
      .upload(path, file, { upsert: true });
    if (error) {
      alert(error.message);
      return "";
    }
    const { data } = supabase.storage
      .from(config.BUCKET)
      .getPublicUrl(path);
    return data.publicUrl;
  }

  async function saveSection(section, items) {
    if (!client) return;
    setSaving(true);
    try {
    const { error: delError } = await supabase
      .from("client_sections")
      .delete()
      .eq("client_slug", client.slug)
      .eq("section", section);
    if (delError) {
      alert("خطأ بالحذف: " + delError.message);
      return;
    }
    const payload = items
      .filter((item) => item.title || item.body || item.image_url || item.link_url)
      .map((item, index) => ({
        client_id: client.id,
        client_slug: client.slug,
        section,
        title: item.title,
        body: item.body,
        image_url: item.image_url,
        link_url: item.link_url,
        sort_order: index,
      }));
    if (payload.length) {
      const { error } = await supabase.from("client_sections").insert(payload);
      if (error) {
        alert(error.message);
      }
    }
    } finally { setSaving(false); }
  }

  async function saveUserSection(items) {
    const userId = session?.user?.id;
    if (!userId) return;
    setSaving(true);
    try {
    const { error: delError } = await supabase.from("app_user_sections").delete().eq("user_id", userId);
    if (delError) {
      alert("خطأ بالحذف: " + delError.message);
      return;
    }
    const payload = items
      .filter((item) => item.title || item.body || item.image_url || item.link_url)
      .map((item, index) => ({
        user_id: userId,
        section: 1,
        title: item.title,
        body: item.body,
        image_url: item.image_url,
        link_url: item.link_url,
        sort_order: index,
      }));
    if (payload.length) {
      const { error } = await supabase.from("app_user_sections").insert(payload);
      if (error) {
        alert(error.message);
      }
    }
    } finally { setSaving(false); }
  }

  function groupBySection(items) {
    return items.reduce((acc, item) => {
      const section = item.section;
      acc[section] = acc[section] || [];
      acc[section].push(item);
      return acc;
    }, {});
  }

  function updateList(setter, list, index, field, value) {
    const updated = [...list];
    updated[index] = { ...updated[index], [field]: value };
    setter(updated);
  }

  function addItem(setter, list) {
    setter([...list, emptyItem()]);
  }

  function removeItem(setter, list, index) {
    const updated = list.filter((_, idx) => idx !== index);
    setter(updated.length ? updated : [emptyItem()]);
  }

  if (!session) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-icon">🕌</div>
            <div>
              <div className="auth-title">بوابة العميل</div>
              <div className="auth-subtitle">
                سجّل دخولك لإدارة المحتوى والمشاركة
              </div>
            </div>
          </div>

          {authMessage && (
            <div className={`alert ${authMessage.type}`}>
              {authMessage.text}
            </div>
          )}

          <div className="auth-form" style={{ marginTop: 12 }}>
            <div className="form-field">
              <label>البريد الإلكتروني</label>
              <input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="form-field">
              <label>كلمة المرور</label>
              <div className="input-row">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="toggle-btn"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? "إخفاء" : "عرض"}
                </button>
              </div>
            </div>
          </div>

          <div className="auth-actions">
            <button className="btn" onClick={signIn} disabled={authBusy}>
              تسجيل الدخول
            </button>
            <button className="btn secondary" onClick={signUp} disabled={authBusy}>
              إنشاء حساب جديد
            </button>
          </div>

          <div className="divider">أو</div>

          <button
            className="btn google"
            onClick={signInWithGoogle}
            disabled={authBusy}
          >
            <span>G</span>
            متابعة عبر Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="card">
        <div className="section-title">مرحبا {client?.name || ""}</div>
        <div className="muted">Slug: {client?.slug}</div>
        <div style={{ marginTop: 12 }}>
          <button className="secondary" onClick={signOut}>
            تسجيل الخروج
          </button>
        </div>
      </div>

      <div className="card">
        <div className="section-title">محتوى المستخدم الخاص</div>
        <ListEditor items={userItems} onChange={setUserItems} onUpload={uploadUserImage} />
        <div className="row">
          <button onClick={() => addItem(setUserItems, userItems)}>
            إضافة عنصر
          </button>
          <button className="secondary" onClick={() => saveUserSection(userItems)} disabled={saving}>
            حفظ المحتوى
          </button>
        </div>
      </div>

      {client && (
        <>
          <div className="card">
            <div className="section-title">1) بيانات الشركة</div>
            <TextBlock item={section1} onChange={setSection1} onUpload={uploadImage} />
            <button onClick={() => saveSection(1, [section1])} disabled={saving}>{saving ? "جاري الحفظ..." : "حفظ القسم"}</button>
          </div>

          <div className="card">
            <div className="section-title">2) روابط الشركة</div>
            <ListEditor items={links} onChange={setLinks} onUpload={uploadImage} />
            <div className="row">
              <button onClick={() => addItem(setLinks, links)}>إضافة رابط</button>
              <button className="secondary" onClick={() => saveSection(2, links)} disabled={saving}>
                حفظ الروابط
              </button>
            </div>
          </div>

          <div className="card">
            <div className="section-title">3) عروض الشركة</div>
            <ListEditor items={offers} onChange={setOffers} onUpload={uploadImage} />
            <div className="row">
              <button onClick={() => addItem(setOffers, offers)}>إضافة عرض</button>
              <button className="secondary" onClick={() => saveSection(3, offers)} disabled={saving}>
                حفظ العروض
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function TextBlock({ item, onChange, onUpload }) {
  return (
    <div className="row">
      <div style={{ flex: 1 }}>
        <label>العنوان</label>
        <input
          value={item.title || ""}
          onChange={(e) => onChange({ ...item, title: e.target.value })}
        />
      </div>
      <div style={{ flex: 1 }}>
        <label>صورة (رابط)</label>
        <input
          value={item.image_url || ""}
          onChange={(e) => onChange({ ...item, image_url: e.target.value })}
        />
        <input
          type="file"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const url = await onUpload(file);
            if (url) onChange({ ...item, image_url: url });
          }}
        />
      </div>
      <div style={{ flex: 1 }}>
        <label>رابط</label>
        <input
          value={item.link_url || ""}
          onChange={(e) => onChange({ ...item, link_url: e.target.value })}
        />
      </div>
      <div style={{ flex: 1 }}>
        <label>النص</label>
        <textarea
          value={item.body || ""}
          onChange={(e) => onChange({ ...item, body: e.target.value })}
        />
      </div>
    </div>
  );
}

function ListEditor({ items, onChange, onUpload }) {
  return (
    <div>
      {items.map((item, index) => (
        <div className="list-item" key={item._key || index}>
          <div className="row">
            <div style={{ flex: 1 }}>
              <label>العنوان</label>
              <input
                value={item.title || ""}
                onChange={(e) =>
                  updateList(onChange, items, index, "title", e.target.value)
                }
              />
            </div>
            <div style={{ flex: 1 }}>
              <label>صورة (رابط)</label>
              <input
                value={item.image_url || ""}
                onChange={(e) =>
                  updateList(onChange, items, index, "image_url", e.target.value)
                }
              />
              <input
                type="file"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const url = await onUpload(file);
                  if (url) {
                    updateList(onChange, items, index, "image_url", url);
                  }
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label>رابط</label>
              <input
                value={item.link_url || ""}
                onChange={(e) =>
                  updateList(onChange, items, index, "link_url", e.target.value)
                }
              />
            </div>
          </div>
          <div style={{ marginTop: 8 }}>
            <label>الوصف</label>
            <textarea
              value={item.body || ""}
              onChange={(e) =>
                updateList(onChange, items, index, "body", e.target.value)
              }
            />
          </div>
          <div style={{ marginTop: 8 }}>
            <button className="danger" onClick={() => removeItem(onChange, items, index)}>
              حذف
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  React.createElement(ErrorBoundary, null, React.createElement(App))
);

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return React.createElement("div", { className: "container" },
        React.createElement("div", { className: "card" },
          React.createElement("div", { className: "section-title" }, "⚠️ حدث خطأ غير متوقع"),
          React.createElement("div", { className: "muted" }, this.state.error?.message || ""),
          React.createElement("button", {
            style: { marginTop: 12 },
            onClick: () => { this.setState({ hasError: false, error: null }); }
          }, "إعادة المحاولة")
        )
      );
    }
    return this.props.children;
  }
}
