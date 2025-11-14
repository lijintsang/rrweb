import { useState } from 'react';
import { fetchMockUsers, fetchMockError } from '../lib/http';

type User = { id: number; name: string };

export default function Users() {
  const [users, setUsers] = useState<Array<{ id: number; name: string }>>([]);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = async () => {
    setError(null);
    const resp = await fetchMockUsers();
    setUsers(resp.data.users);
  };

  const triggerError = async () => {
    setError(null);
    try {
      await fetchMockError();
    } catch (e: any) {
      setError(e?.message || '请求失败');
    }
  };

  return (
    <section>
      <h1>用户页面</h1>
      <p>这是用户页面。</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button onClick={loadUsers}>请求用户列表（记录请求/响应）</button>
        <button onClick={triggerError}>请求失败示例（记录错误）</button>
      </div>

      {error && <p style={{ color: '#ff4d4f' }}>错误：{error}</p>}

      <ul>
        {users.map((u) => (
          <li key={u.id}>{u.name}</li>
        ))}
      </ul>
    </section>
  );
}