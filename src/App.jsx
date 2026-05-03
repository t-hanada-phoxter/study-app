import { useEffect, useState } from "react";

const URL = "https://docs.google.com/spreadsheets/d/1ZQn3vKJH6fPpJIrwJiPYfIvbm9p9-Qq7kiRbUpfIuoY/gviz/tq?tqx=out:csv&sheet=questions";

export default function App(){
  const [q,setQ]=useState([]);
  const [i,setI]=useState(0);
  const [sel,setSel]=useState(null);
  const [show,setShow]=useState(false);
  const [start,setStart]=useState(Date.now());
  const [time,setTime]=useState(null);

  useEffect(()=>{
    fetch(URL).then(r=>r.text()).then(t=>{
      const l=t.split("\n").slice(1);
      setQ(l.map(x=>{
        const v=x.split(",");
        return {id:v[0],q:v[8],c:[v[9],v[10],v[11],v[12]],a:Number(v[13])-1}
      }));
    })
  },[]);

  useEffect(()=>{
    setShow(false);
    setTimeout(()=>setShow(true),1000);
    setStart(Date.now());
  },[i]);

  if(!q.length)return <div>Loading...</div>;
  const cur=q[i];

  function answer(idx){
    if(sel!==null)return;
    setSel(idx);
    setTime(((Date.now()-start)/1000).toFixed(1));
  }

  function next(){
    setSel(null);
    setTime(null);
    setI((i+1)%q.length);
  }

  return (
    <div style={{padding:20,fontSize:18}}>
      <h2>{cur.q}</h2>

      {!show && <div>考えてください...</div>}

      {show && cur.c.map((c,idx)=>(
        <button key={idx} onClick={()=>answer(idx)} style={{display:"block",margin:10,padding:10}}>
          {idx+1}:{c}
        </button>
      ))}

      {sel!==null && (
        <div>
          <div>時間:{time}s {sel===cur.a?"正解":"不正解"}</div>
          <button onClick={next}>次へ</button>
        </div>
      )}
    </div>
  );
}
