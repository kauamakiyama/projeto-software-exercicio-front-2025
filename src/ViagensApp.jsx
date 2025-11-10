import { useAuth0 } from "@auth0/auth0-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import LoginButton from "./LoginButton";
import LogoutButton from "./LogoutButton";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://56.124.107.104:8080";

const ROLE_NAMESPACE =
  import.meta.env.VITE_AUTH0_ROLE_NAMESPACE ??
  "https://dev-hb5tnbkuyk217lt2.us.auth0.com/roles";

const ROLE_CLAIM_KEYS = [ROLE_NAMESPACE, "https://schemas.auth0.com/roles", "roles"];
const ADMIN_ROLE = "admin";

function decodeJwtPayload(token) {
  if (!token) return null;
  try {
    const [, base64Payload] = token.split(".");
    if (!base64Payload) return null;
    const normalized = base64Payload.replace(/-/g, "+").replace(/_/g, "/");
    const payload = atob(normalized);
    const json = decodeURIComponent(
      payload
        .split("")
        .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`)
        .join("")
    );
    return JSON.parse(json);
  } catch (err) {
    console.error("Erro ao decodificar token JWT:", err);
    return null;
  }
}

function extractRolesFromSource(source) {
  if (!source) return [];
  return ROLE_CLAIM_KEYS.flatMap((key) => {
    const value = source[key];
    return Array.isArray(value) ? value : [];
  });
}

export default function ViagensApp() {
  const [viagens, setViagens] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [token, setToken] = useState("");

  const [origem, setOrigem] = useState("");
  const [destino, setDestino] = useState("");
  const [descricao, setDescricao] = useState("");
  const [modoTransporte, setModoTransporte] = useState("");

  const { user, isAuthenticated, isLoading, getAccessTokenSilently } =
    useAuth0();

  const refreshToken = useCallback(async () => {
    try {
      const accessToken = await getAccessTokenSilently();
      setToken(accessToken);
      return accessToken;
    } catch (err) {
      console.error("Erro ao buscar token:", err);
      setError("Não foi possível recuperar o token de acesso.");
      return "";
    }
  }, [getAccessTokenSilently]);

  const fetchViagens = useCallback(
    async (providedToken) => {
      const activeToken = providedToken ?? token;
      if (!activeToken) return;

      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE_URL}/viagens`, {
          headers: {
            Authorization: `Bearer ${activeToken}`,
          },
        });
        if (!res.ok) throw new Error(`Erro ao carregar: ${res.status}`);
        const data = await res.json();
        setViagens(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    if (!isAuthenticated) {
      setToken("");
      setViagens([]);
      return;
    }

    let cancelled = false;

    (async () => {
      const accessToken = await refreshToken();
      if (!cancelled && accessToken) {
        await fetchViagens(accessToken);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, refreshToken, fetchViagens]);

  const payload = useMemo(() => decodeJwtPayload(token), [token]);
  const roles = useMemo(() => {
    const fromToken = extractRolesFromSource(payload);
    const fromUser = extractRolesFromSource(user);
    return new Set([...fromToken, ...fromUser]);
  }, [payload, user]);

  const isAdmin = roles.has(ADMIN_ROLE);

  if (isLoading) {
    return <div className="page-status">Carregando autenticação...</div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="login-container">
        <h1 className="app-title">Viagens</h1>
        <p className="app-subtitle">
          Entre para cadastrar e acompanhar suas viagens.
        </p>
        <LoginButton />
      </div>
    );
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError(null);

    if (!origem || !destino || !modoTransporte) {
      setError("Origem, destino e modo de transporte são obrigatórios.");
      return;
    }

    const dto = {
      origemNome: origem.trim(),
      destinoNome: destino.trim(),
      descricao: descricao.trim() || null,
      modoTransporte: modoTransporte.trim(),
    };

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/viagens`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(dto),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Erro ao criar: ${res.status} ${text}`);
      }

      const created = await res.json();
      setViagens((prev) => [created, ...prev]);

      setOrigem("");
      setDestino("");
      setDescricao("");
      setModoTransporte("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    if (!isAdmin) return;
    setError(null);
    setDeletingId(id);

    try {
      const res = await fetch(`${API_BASE_URL}/viagens/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Erro ao excluir: ${res.status} ${text}`);
      }

      setViagens((prev) => prev.filter((viagem) => viagem.id !== id));
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="page">
      <header className="top-bar">
        <div className="user-info">
          {user.picture && (
            <img
              className="user-avatar"
              src={user.picture}
              alt={user.name ?? "Usuário"}
            />
          )}
          <div>
            <div className="user-name">{user.name}</div>
            <div className="user-email">{user.email}</div>
            {isAdmin && <div className="user-role-pill">Administrador</div>}
          </div>
        </div>
        <div className="top-bar-actions">
          <button type="button" onClick={() => fetchViagens()} disabled={loading}>
            {loading ? "Atualizando..." : "Recarregar"}
          </button>
          <LogoutButton />
        </div>
      </header>

      <main className="content">
        <section className="card">
          <h1 className="card-title">Cadastrar nova viagem</h1>
          <form className="form" onSubmit={handleCreate}>
            <div className="form-grid">
              <label className="form-field">
                <span>Origem</span>
                <input
                  value={origem}
                  onChange={(e) => setOrigem(e.target.value)}
                />
              </label>
              <label className="form-field">
                <span>Destino</span>
                <input
                  value={destino}
                  onChange={(e) => setDestino(e.target.value)}
                />
              </label>
            </div>

            <label className="form-field">
              <span>Descrição</span>
              <textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={3}
              />
            </label>

            <label className="form-field">
              <span>Modo de transporte</span>
              <input
                value={modoTransporte}
                onChange={(e) => setModoTransporte(e.target.value)}
              />
            </label>

            <div className="form-actions">
              <button type="submit" disabled={submitting}>
                {submitting ? "Salvando..." : "Salvar viagem"}
              </button>
            </div>
          </form>
          {error && <div className="feedback feedback-error">{error}</div>}
        </section>

        <section className="card">
          <div className="card-header">
            <h2 className="card-title">Viagens cadastradas</h2>
            <span className="counter">{viagens.length}</span>
          </div>
          {loading ? (
            <div className="feedback">Carregando viagens...</div>
          ) : viagens.length === 0 ? (
            <div className="feedback">Nenhuma viagem cadastrada até o momento.</div>
          ) : (
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Origem</th>
                    <th>Destino</th>
                    <th>Modo</th>
                    <th>Descrição</th>
                    {isAdmin && <th className="actions">Ações</th>}
                  </tr>
                </thead>
                <tbody>
                  {viagens.map((viagem) => (
                    <tr key={viagem.id}>
                      <td>{viagem.origemNome ?? "-"}</td>
                      <td>{viagem.destinoNome ?? "-"}</td>
                      <td>{viagem.modoTransporte ?? "-"}</td>
                      <td className="descricao-cell">
                        {viagem.descricao?.trim() || "—"}
                      </td>
                      {isAdmin && (
                        <td className="actions">
                          <button
                            type="button"
                            onClick={() => handleDelete(viagem.id)}
                            disabled={deletingId === viagem.id}
                            className="danger"
                          >
                            {deletingId === viagem.id ? "Excluindo..." : "Excluir"}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

