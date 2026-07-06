import net from 'node:net';

const isPrivateIpv4 = (ip: string): boolean => {
  const [first, second] = ip.split('.').map((part) => Number(part));
  return (
    first === 10 ||
    first === 127 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 169 && second === 254) ||
    first === 0
  );
};

// Extract the embedded IPv4 from an IPv4-mapped IPv6 address like "::ffff:127.0.0.1".
const extractMappedIpv4 = (lower: string): string | null => {
  const match = lower.match(/::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
  return match ? match[1] : null;
};

export const isPrivateNetworkHostname = (hostname: string): boolean => {
  const normalizedHostname = hostname.replace(/^\[|\]$/g, '');
  const ipVersion = net.isIP(normalizedHostname);

  if (ipVersion === 4) {
    return isPrivateIpv4(normalizedHostname);
  }

  if (ipVersion === 6) {
    const lower = normalizedHostname.toLowerCase();
    // IPv4-mapped IPv6 addresses bypass the IPv6 private checks below — normalize and re-check.
    const mappedIpv4 = extractMappedIpv4(lower);
    if (mappedIpv4 && net.isIP(mappedIpv4) === 4) {
      return isPrivateIpv4(mappedIpv4);
    }
    return lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80:');
  }

  return ['localhost', 'localhost.localdomain'].includes(normalizedHostname.toLowerCase());
};
