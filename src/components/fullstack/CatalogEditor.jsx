import { useState } from 'react'
import { api } from '../../services/api.js'

const definitions = {
  branches: { title: 'Sucursales',fields: [['name','Nombre'],['address','Dirección ficticia']] },
  services: { title: 'Servicios',fields: [['name','Nombre'],['branchId','Sucursal','branches'],['description','Descripción'],['duration','Duración (min)','number'],['price','Precio (CLP)','number']] },
  professionals: { title: 'Profesionales',fields: [['name','Nombre ficticio'],['branchId','Sucursal','branches'],['title','Especialidad'],['bio','Biografía']] },
  modules: { title: 'Módulos de atención',fields: [['name','Nombre'],['branchId','Sucursal','branches'],['professionalId','Profesional','professionals']] },
}

export default function CatalogEditor({ resource,data,run }) {
  const [editing,setEditing] = useState(null)
  const definition = definitions[resource]
  const blank = () => Object.fromEntries([...definition.fields.map(([key,,type]) => [key,type === 'number' ? (key === 'duration' ? 30 : 0) : '']),['active',true]])
  const [form,setForm] = useState(blank)
  const reset = () => { setEditing(null); setForm(blank()) }
  const update = (key,value) => setForm((prev) => ({ ...prev,[key]: value,...(key === 'branchId' && resource === 'modules' ? { professionalId: '' } : {}) }))
  const submit = async (event) => {
    event.preventDefault()
    if (await run(() => api(`/${resource}${editing ? `/${editing}` : ''}`,{ method: editing ? 'PATCH' : 'POST',body: form }),`${definition.title}: datos guardados.`)) reset()
  }
  return <section className="fs-card">
    <h2>{definition.title}</h2>
    <div className="fs-list">
      {data[resource].length === 0 && <p>No hay registros.</p>}
      {data[resource].map((item) => <div className="fs-row" key={item.id}>
        <div><strong>{item.name}</strong><small>{item.active ? 'Activo' : 'Inactivo'}{item.duration ? ` · ${item.duration} min · $${item.price}` : ''}</small></div>
        <div className="fs-actions"><button type="button" onClick={() => { setEditing(item.id); setForm(Object.fromEntries([...definition.fields.map(([key]) => [key,item[key] ?? '']),['active',item.active]])) }}>Editar {item.name}</button>
          {item.active && <button type="button" onClick={() => run(() => api(`/${resource}/${item.id}`,{ method: 'DELETE' }),'Registro desactivado; historial conservado.')}>Desactivar {item.name}</button>}</div>
      </div>)}
    </div>
    <form className="fs-form" onSubmit={submit}>
      <h3>{editing ? 'Editar registro' : 'Agregar registro'}</h3>
      {definition.fields.map(([key,label,type]) => <label key={key}>{label}
        {type && !['number'].includes(type) ? <select required value={form[key]} onChange={(event) => update(key,event.target.value)}>
          <option value="">Selecciona…</option>
          {data[type].filter((item) => (item.active || item.id === form[key]) && (type !== 'professionals' || item.branchId === form.branchId)).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select> : <input required={!['bio','title','description'].includes(key)} maxLength={key === 'bio' ? 1000 : key === 'description' ? 500 : key === 'address' ? 200 : key === 'title' ? 150 : 100} type={type === 'number' ? 'number' : 'text'} min={key === 'duration' ? 5 : 0} max={key === 'duration' ? 480 : 100000000} value={form[key]} onChange={(event) => update(key,type === 'number' ? (event.target.value === '' ? '' : Number(event.target.value)) : event.target.value)} />}
      </label>)}
      <label className="fs-check"><input type="checkbox" checked={form.active} onChange={(event) => update('active',event.target.checked)} />Activo</label>
      <div className="fs-actions"><button className="button button--primary" type="submit">{editing ? 'Guardar cambios' : 'Crear registro'}</button>{editing && <button type="button" onClick={reset}>Cancelar edición</button>}</div>
    </form>
  </section>
}
