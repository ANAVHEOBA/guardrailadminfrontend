export default function AdminJsonResult(props: { value: unknown }) {
  return <pre class="pm-json-output">{JSON.stringify(props.value, null, 2)}</pre>;
}
