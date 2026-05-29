import { type ComponentProps } from "solid-js"

export const Mark = (props: { class?: string }) => {
  return (
    <svg
      data-component="logo-mark"
      classList={{ [props.class ?? ""]: !!props.class }}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g transform="translate(-10, -1)" stroke="currentColor" stroke-width="4">
        <path d="M 22 4 L 46 4 L 56 18 L 50 36 L 34 46 L 18 36 L 12 18 Z" stroke-linejoin="miter" fill="none"/>
        <path d="M 27 37 L 27 13" stroke-linecap="square"/>
        <path d="M 27 19 L 51 11" stroke-linecap="square"/>
        <path d="M 27 31 L 48 37" stroke-linecap="square"/>
      </g>
    </svg>
  )
}

export const Splash = (props: Pick<ComponentProps<"svg">, "ref" | "class">) => {
  return (
    <svg
      ref={props.ref}
      data-component="logo-splash"
      classList={{ [props.class ?? ""]: !!props.class }}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g transform="translate(-10, -1)" stroke="currentColor" stroke-width="4">
        <path d="M 22 4 L 46 4 L 56 18 L 50 36 L 34 46 L 18 36 L 12 18 Z" stroke-linejoin="miter" fill="none"/>
        <path d="M 27 37 L 27 13" stroke-linecap="square"/>
        <path d="M 27 19 L 51 11" stroke-linecap="square"/>
        <path d="M 27 31 L 48 37" stroke-linecap="square"/>
      </g>
    </svg>
  )
}

export const Logo = (props: { class?: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 220 48"
      fill="none"
      classList={{ [props.class ?? ""]: !!props.class }}
      stroke="currentColor"
      stroke-width="4"
    >
      <path d="M 22 4 L 46 4 L 56 18 L 50 36 L 34 46 L 18 36 L 12 18 Z" stroke-linejoin="miter" fill="none"/>
      <path d="M 27 37 L 27 13" stroke-linecap="square"/>
      <path d="M 27 19 L 51 11" stroke-linecap="square"/>
      <path d="M 27 31 L 48 37" stroke-linecap="square"/>
      <path d="M 66 6 L 66 42" stroke-linecap="square"/>
      <path d="M 70 20 L 86 8" stroke-linecap="square" stroke-linejoin="miter"/>
      <path d="M 70 24 L 86 40" stroke-linecap="square" stroke-linejoin="miter"/>
      <rect x="98" y="10" width="22" height="32" rx="3" fill="none"/>
      <rect x="130" y="10" width="22" height="32" rx="3" fill="none"/>
      <path d="M 152 6 L 152 42" stroke-linecap="square"/>
      <path d="M 184 10 L 164 10 Q 162 10 162 26 Q 162 42 164 42 L 184 42" fill="none" stroke-linecap="square"/>
      <path d="M 167 20 L 186 20" stroke-linecap="square"/>
    </svg>
  )
}
