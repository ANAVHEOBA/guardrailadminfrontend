export function readRequiredText(formData: FormData, key: string, label: string) {
  const value = String(formData.get(key) ?? "").trim();

  if (!value) {
    throw new Error(`${label} is required.`);
  }

  return value;
}

export function readOptionalText(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();

  return value ? value : undefined;
}

export function readOptionalInteger(formData: FormData, key: string, label: string) {
  const value = String(formData.get(key) ?? "").trim();

  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} must be a whole number.`);
  }

  return parsed;
}

export function readOptionalBoolean(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim().toLowerCase();

  if (!value) {
    return undefined;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new Error(`${key} must be true or false.`);
}

export function readDateTimeValue(
  formData: FormData,
  key: string,
  label: string,
  options: { required?: boolean } = {},
) {
  const value = String(formData.get(key) ?? "").trim();

  if (!value) {
    if (options.required) {
      throw new Error(`${label} is required.`);
    }

    return undefined;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${label} must be a valid date and time.`);
  }

  return parsed.toISOString();
}

export function readStringList(formData: FormData, key: string) {
  const rawValue = String(formData.get(key) ?? "");

  const values = rawValue
    .split(/\r?\n|,/)
    .map(value => value.trim())
    .filter(Boolean);

  return values.length > 0 ? values : undefined;
}
