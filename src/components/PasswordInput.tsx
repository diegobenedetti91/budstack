"use client";

import { useState } from "react";
import { Icon } from "./Icon";

/** Campo de senha com botão de mostrar/ocultar. */
export function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div className="pw-wrap">
      <input {...props} type={show ? "text" : "password"} />
      <button type="button" className="pw-toggle" onClick={() => setShow((v) => !v)} aria-label={show ? "Ocultar senha" : "Mostrar senha"}>
        <Icon name={show ? "eyeoff" : "eye"} className="ico sm" />
      </button>
    </div>
  );
}
