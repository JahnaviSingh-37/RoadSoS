import { useEffect, useState } from 'react';

export function useLocation() {
  const [location, setLocation] = useState(null);

  useEffect(() => {
    setLocation(null);
  }, []);

  return location;
}
