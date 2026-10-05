export function HotelPublicInfo({ info }: { info: any }) {
  return (
    <div className="space-y-4">
      <section className="clay p-5">
        <h2 className="text-lg font-semibold">Facilities</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {(info?.facilities ?? []).map((f: any) => (
            <li key={f.name} className="flex justify-between"><span>{f.name}</span><span className="text-muted-foreground">{f.hours}</span></li>
          ))}
        </ul>
      </section>
      <section className="clay p-5">
        <h2 className="text-lg font-semibold">Around us</h2>
        <ul className="mt-3 space-y-3 text-sm">
          {(info?.local_guide ?? []).map((g: any) => (
            <li key={g.name}><div className="font-semibold">{g.name} <span className="font-normal text-muted-foreground">· {g.distance_km} km</span></div><div className="text-muted-foreground">{g.note}</div></li>
          ))}
        </ul>
      </section>
      <section className="clay p-5">
        <h2 className="text-lg font-semibold">Contacts</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {(info?.contacts ?? []).map((c: any) => (
            <li key={c.name} className="flex justify-between"><span>{c.name}</span><a className="font-semibold text-primary" href={`tel:${c.phone}`}>{c.phone}</a></li>
          ))}
        </ul>
      </section>
    </div>
  );
}

