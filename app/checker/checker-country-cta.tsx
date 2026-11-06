"use client";
import { useState } from "react";
import CountryPicker from "@/components/ui/CountryPicker";
import { Button } from "@/components/ui/primitives";

export default function CheckerCountryCta() {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");

  return (
    <div style={{ marginTop: 14 }}>
      <label className="label" style={{ marginBottom: 6 }}>Build a resume tailored to a company in your country</label>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <CountryPicker value={code} onChange={(c, n) => { setCode(c); setName(n); }} />
        </div>
        {code ? (
          <Button as="a" href={`/build#country=${code}`} style={{ whiteSpace: "nowrap" }}>
            Build my {name} resume →
          </Button>
        ) : (
          <Button type="button" className="cursor-not-allowed opacity-[0.55]" disabled style={{ whiteSpace: "nowrap" }}>
            👆 Pick a country first
          </Button>
        )}
      </div>
    </div>
  );
}
