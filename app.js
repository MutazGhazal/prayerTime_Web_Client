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

const emptyItem = () => ({
  title: "",
  body: "",
  image_url: "",
  link_url: "",
});

function App() {
  if (!supabase) {
    return (
      <div className="container">
        <div className="card">تعذر تشغيل البوابة حالياً.</div>
      </div>
    );
  }
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [client, setClient] = useState(null);
  const [section1, setSection1] = useState(emptyItem());
  const [links, setLinks] = useState([emptyItem()]);
  const [offers, setOffers] = useState([emptyItem()]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    supabase.auth.onAuthStateChange((_event, session) =>
      setSession(session)
    );
  }, []);

  useEffect(() => {
    if (session) {
      loadClientProfile();
    }
  }, [session]);

  async function signIn() {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) alert(error.message);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setClient(null);
  }

  async function loadClientProfile() {
    const { data, error } = await supabase
      .from("client_users")
      .select("client_id, clients (id, name, slug, logo_url)")
      .single();
    if (error) {
      alert(error.message);
      return;
    }
    setClient(data.clients);
    loadContent(data.clients);
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

  async function saveSection(section, items) {
    if (!client) return;
    await supabase
      .from("client_sections")
      .delete()
      .eq("client_slug", client.slug)
      .eq("section", section);
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
      <div className="container">
        <div className="card">
          <div className="section-title">تسجيل الدخول</div>
          <label>البريد الإلكتروني</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} />
          <label style={{ marginTop: 8 }}>كلمة المرور</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div style={{ marginTop: 12 }}>
            <button onClick={signIn}>دخول</button>
          </div>
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
        <div className="section-title">1) بيانات الشركة</div>
        <TextBlock item={section1} onChange={setSection1} onUpload={uploadImage} />
        <button onClick={() => saveSection(1, [section1])}>حفظ القسم</button>
      </div>

      <div className="card">
        <div className="section-title">2) روابط الشركة</div>
        <ListEditor items={links} onChange={setLinks} onUpload={uploadImage} />
        <div className="row">
          <button onClick={() => addItem(setLinks, links)}>إضافة رابط</button>
          <button className="secondary" onClick={() => saveSection(2, links)}>
            حفظ الروابط
          </button>
        </div>
      </div>

      <div className="card">
        <div className="section-title">3) عروض الشركة</div>
        <ListEditor items={offers} onChange={setOffers} onUpload={uploadImage} />
        <div className="row">
          <button onClick={() => addItem(setOffers, offers)}>إضافة عرض</button>
          <button className="secondary" onClick={() => saveSection(3, offers)}>
            حفظ العروض
          </button>
        </div>
      </div>
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
        <div className="list-item" key={index}>
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

function updateList(setter, list, index, field, value) {
  const updated = [...list];
  updated[index] = { ...updated[index], [field]: value };
  setter(updated);
}

function removeItem(setter, list, index) {
  const updated = list.filter((_, idx) => idx !== index);
  setter(updated.length ? updated : [emptyItem()]);
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
