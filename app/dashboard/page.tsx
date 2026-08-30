import {redirect} from 'next/navigation';import {supabaseServer} from '../../lib/supabase-server';import Dashboard from '../../components/Dashboard';
export default async function Page(){const s=await supabaseServer();const {data:{user}}=await s.auth.getUser();if(!user)redirect('/login');return <Dashboard email={user.email||''}/>}
