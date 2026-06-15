import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const EMAIL_DOMAINS = [
  "qq.com",
  "163.com",
  "126.com",
  "gmail.com",
  "outlook.com",
  "foxmail.com",
  "icloud.com",
  "sina.com",
  "sohu.com",
  "yahoo.com",
];

interface EmailInputProps {
  value: string;
  onChange: (email: string) => void;
  id?: string;
  required?: boolean;
}

/**
 * Split email input: text field for the local part, dropdown for the domain.
 * `value` is always the full email (e.g. "user@qq.com").
 */
export default function EmailInput({ value, onChange, id, required }: EmailInputProps) {
  const [selectedDomain, setSelectedDomain] = useState("qq.com");

  const atIdx = value.indexOf("@");
  const localPart = atIdx >= 0 ? value.slice(0, atIdx) : value;
  // Use domain from parent value if present, otherwise use internal selection
  const domain = atIdx >= 0 ? value.slice(atIdx + 1) : selectedDomain;

  const handleLocalChange = (local: string) => {
    const clean = local.replace(/@/g, "");
    onChange(clean ? `${clean}@${domain}` : "");
  };

  const handleDomainChange = (newDomain: string) => {
    setSelectedDomain(newDomain);
    onChange(localPart ? `${localPart}@${newDomain}` : "");
  };

  return (
    <div className="flex items-center gap-0">
      <Input
        id={id}
        type="text"
        placeholder="用户名"
        value={localPart}
        onChange={(e) => handleLocalChange(e.target.value)}
        required={required && !domain}
        autoComplete="email"
        className="flex-1 min-w-0 rounded-r-none border-r-0 focus-visible:z-10"
      />
      <Select value={domain} onValueChange={handleDomainChange}>
        <SelectTrigger className="w-[130px] rounded-l-none focus:z-10">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {EMAIL_DOMAINS.map((d) => (
            <SelectItem key={d} value={d}>
              @{d}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
