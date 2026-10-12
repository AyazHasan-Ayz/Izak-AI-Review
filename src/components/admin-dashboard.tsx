'use client';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  Plus,
  Search,
  Pencil,
  Power,
  QrCode,
  Trash2,
  LogOut,
  X,
  Download,
  Copy,
  RotateCw,
  LoaderCircle,
} from 'lucide-react';
import { Brand } from './brand';
import type { AdminBusiness, BusinessInput } from '@/lib/business-schema';

const initial: BusinessInput = {
  name: '',
  category: '',
  city: '',
  google_review_url: '',
  seo_keywords: [],
  daily_limit: 100,
  status: 'active',
};
async function api(path: string, method = 'GET', body?: unknown) {
  const response = await fetch(`/api/admin${path}`, {
    method,
    cache: 'no-store',
    ...(body === undefined
      ? {}
      : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });
  const result = await response.json();
  if (response.status === 401 || response.status === 403) window.location.assign('/admin/login');
  if (!response.ok) throw new Error(result.error || 'The request failed.');
  return result;
}
function fields(b: AdminBusiness): BusinessInput {
  return {
    name: b.name,
    category: b.category,
    city: b.city,
    google_review_url: b.google_review_url,
    seo_keywords: b.seo_keywords,
    daily_limit: b.daily_limit,
    status: b.status,
  };
}
export function AdminDashboard() {
  const [businesses, setBusinesses] = useState<AdminBusiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<AdminBusiness | 'new' | null>(null);
  const [link, setLink] = useState<{ business: AdminBusiness; url: string } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const load = useCallback(async () => {
    try {
      setBusinesses((await api('/businesses')).businesses);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void Promise.resolve().then(load);
    const timer = setInterval(() => {
      void api('/auth').catch(() => {});
    }, 60000);
    return () => clearInterval(timer);
  }, [load]);
  useEffect(() => {
    if (edit || link) dialog.current?.showModal();
    else dialog.current?.close();
  }, [edit, link]);
  async function action(work: () => Promise<void>) {
    setBusy(true);
    setMessage('');
    try {
      await work();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const input: BusinessInput = {
      name: String(form.get('name')),
      category: String(form.get('category')),
      city: String(form.get('city')),
      google_review_url: String(form.get('google_review_url')),
      seo_keywords: String(form.get('seo_keywords'))
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      daily_limit: Number(form.get('daily_limit')),
      status: form.get('active') === 'on' ? 'active' : 'inactive',
    };
    const logo = form.get('logo') as File;
    await action(async () => {
      let business = edit === 'new' ? (await api('/businesses', 'POST', input)).business : edit;
      if (!business) return;
      // Retain the newly created ID if upload fails, so retry never creates duplicates.
      if (edit === 'new') {
        setEdit({ ...business, ...input });
      }
      if (logo?.size) {
        const response = await fetch(`/api/admin/businesses/${business.id}/logo`, {
          method: 'POST',
          headers: { 'Content-Type': logo.type },
          body: logo,
        });
        const result = await response.json();
        if (!response.ok)
          throw new Error(
            result.error || 'Logo upload failed. The business has been saved inactive.',
          );
        if (result.warning) setMessage(result.warning);
        business = { ...business, logo_url: result.logo_url };
        setEdit({ ...business, ...input });
      }
      await api(`/businesses/${business.id}`, 'PATCH', input);
      setEdit(null);
    });
    await load();
  }
  const active = businesses.filter((b) => b.status === 'active').length;
  const rows = businesses.filter((b) =>
    `${b.name} ${b.city} ${b.category}`.toLowerCase().includes(query.toLowerCase()),
  );
  const current = edit && edit !== 'new' ? edit : initial;
  return (
    <main className="admin-shell">
      <header className="admin-header">
        <Brand />
        <button
          className="button button-outline"
          disabled={busy}
          onClick={() =>
            void action(async () => {
              await api('/auth', 'POST', { action: 'logout' });
              window.location.assign('/admin/login');
            })
          }
        >
          <LogOut size={17} />
          Sign out
        </button>
      </header>
      <section className="admin-title">
        <div>
          <span className="eyebrow">PRIVATE ADMINISTRATION</span>
          <h1>Businesses</h1>
        </div>
        <button
          className="button button-gold"
          disabled={busy || loading}
          onClick={() => {
            setMessage('');
            setEdit('new');
          }}
        >
          <Plus size={18} />
          Add New Business
        </button>
      </section>
      <section className="admin-stats" aria-label="Business totals">
        <div>
          <span>Total businesses</span>
          <strong>{loading ? '-' : businesses.length}</strong>
        </div>
        <div>
          <span>Active</span>
          <strong>{loading ? '-' : active}</strong>
        </div>
        <div>
          <span>Inactive</span>
          <strong>{loading ? '-' : businesses.length - active}</strong>
        </div>
      </section>
      {message && !edit && !link && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      <label className="admin-search">
        <Search size={18} />
        <input
          aria-label="Search businesses"
          placeholder="Search businesses, categories or cities"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      {loading ? (
        <p role="status">Loading businesses...</p>
      ) : rows.length === 0 ? (
        <div className="admin-empty">
          <h2>{query ? 'No matching businesses' : 'No businesses yet'}</h2>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Business</th>
                <th>Status</th>
                <th>Daily limit</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id}>
                  <td>
                    <div className="business-cell">
                      {b.logo_url ? (
                        <img src={b.logo_url} alt="" width={40} height={40} />
                      ) : (
                        <span className="logo-placeholder">{b.name.slice(0, 1)}</span>
                      )}
                      <div>
                        <strong>{b.name}</strong>
                        <small>
                          {b.category} · {b.city}
                        </small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`status-label ${b.status}`}>{b.status}</span>
                  </td>
                  <td>{b.daily_limit}</td>
                  <td>
                    <div className="admin-actions">
                      <button
                        title="Edit business"
                        aria-label={`Edit ${b.name}`}
                        disabled={busy}
                        onClick={() => {
                          setMessage('');
                          setEdit(b);
                        }}
                      >
                        <Pencil size={17} />
                      </button>
                      <button
                        title={b.status === 'active' ? 'Deactivate' : 'Activate'}
                        aria-label={`${b.status === 'active' ? 'Deactivate' : 'Activate'} ${b.name}`}
                        disabled={busy}
                        onClick={() =>
                          void action(async () => {
                            await api(`/businesses/${b.id}`, 'PATCH', {
                              ...fields(b),
                              status: b.status === 'active' ? 'inactive' : 'active',
                            });
                            await load();
                          })
                        }
                      >
                        <Power size={17} />
                      </button>
                      <button
                        title="QR code and NFC link"
                        aria-label={`QR code for ${b.name}`}
                        disabled={busy}
                        onClick={() =>
                          void action(async () => {
                            const result = await api(`/businesses/${b.id}/link`);
                            setLink({ business: b, url: result.url });
                          })
                        }
                      >
                        <QrCode size={18} />
                      </button>
                      <button
                        title="Delete business"
                        aria-label={`Delete ${b.name}`}
                        disabled={busy}
                        onClick={() => {
                          if (
                            confirm(
                              `Permanently delete ${b.name}? Its review link will stop working and usage records will be removed.`,
                            )
                          )
                            void action(async () => {
                              const result = await api(`/businesses/${b.id}`, 'DELETE', {
                                confirm: b.id,
                              });
                              if (result.warning) setMessage(result.warning);
                              await load();
                            });
                        }}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <dialog
        ref={dialog}
        className="admin-dialog"
        onCancel={(e) => {
          if (busy) e.preventDefault();
          else {
            setEdit(null);
            setLink(null);
          }
        }}
      >
        <div className="dialog-heading">
          <h2>{link ? link.business.name : edit === 'new' ? 'Add business' : 'Edit business'}</h2>
          <button
            className="icon-button"
            title="Close"
            aria-label="Close"
            disabled={busy}
            onClick={() => {
              setEdit(null);
              setLink(null);
            }}
          >
            <X size={20} />
          </button>
        </div>
        {message && (
          <p role="status" className="notice error">
            {message}
          </p>
        )}
        {edit && (
          <form className="admin-form" onSubmit={save} key={edit === 'new' ? 'new' : edit.id}>
            <label className="field">
              <span>Business name</span>
              <input
                name="name"
                defaultValue={current.name}
                required
                minLength={2}
                maxLength={100}
              />
            </label>
            <label className="field">
              <span>Business logo</span>
              <input
                name="logo"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                required={edit === 'new' || !edit.logo_url}
              />
            </label>
            <div className="form-columns">
              <label className="field">
                <span>Category</span>
                <input name="category" defaultValue={current.category} required maxLength={100} />
              </label>
              <label className="field">
                <span>City / location</span>
                <input name="city" defaultValue={current.city} required maxLength={100} />
              </label>
            </div>
            <label className="field">
              <span>Official Google Review URL</span>
              <input
                type="url"
                name="google_review_url"
                defaultValue={current.google_review_url}
                required
                maxLength={2048}
              />
            </label>
            <label className="field">
              <span>SEO planning keywords</span>
              <textarea
                name="seo_keywords"
                defaultValue={current.seo_keywords.join(', ')}
                maxLength={1600}
              />
            </label>
            <label className="field">
              <span>Daily AI generation limit</span>
              <input
                type="number"
                name="daily_limit"
                defaultValue={current.daily_limit}
                required
                min={1}
                max={10000}
              />
            </label>
            <label className="admin-checkbox">
              <input name="active" type="checkbox" defaultChecked={current.status === 'active'} />
              Active
            </label>
            <button className="button button-gold" disabled={busy}>
              {busy && <LoaderCircle size={17} className="spin" />}Save business
            </button>
          </form>
        )}
        {link && (
          <div className="admin-form">
            <img
              key={link.url}
              className="qr-preview"
              src={`/api/admin/businesses/${link.business.id}/link?format=png&v=${encodeURIComponent(link.url.slice(-8))}`}
              alt={`QR code for ${link.business.name}`}
              width={240}
              height={240}
            />
            <label className="field">
              <span>Review / NFC URL</span>
              <input readOnly value={link.url} />
            </label>
            <button
              className="button button-outline"
              disabled={busy}
              onClick={() =>
                void action(async () => {
                  await navigator.clipboard.writeText(link.url);
                  setMessage('Review link copied.');
                })
              }
            >
              <Copy size={17} />
              Copy link
            </button>
            <div className="form-columns">
              {['png', 'svg'].map((format) => (
                <a
                  key={format}
                  className="button button-outline"
                  href={`/api/admin/businesses/${link.business.id}/link?format=${format}`}
                  download
                >
                  <Download size={17} />
                  {format.toUpperCase()}
                </a>
              ))}
            </div>
            <button
              className="button button-outline"
              disabled={busy}
              onClick={() => {
                if (
                  confirm(
                    'Revoke the current review link? Existing QR codes and NFC tags will stop working.',
                  )
                )
                  void action(async () => {
                    await api(`/businesses/${link.business.id}`, 'PATCH', { action: 'rotate' });
                    const result = await api(`/businesses/${link.business.id}/link`);
                    setLink({ ...link, url: result.url });
                  });
              }}
            >
              <RotateCw size={17} />
              Rotate review link
            </button>
          </div>
        )}
      </dialog>
    </main>
  );
}
