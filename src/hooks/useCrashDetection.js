import { useEffect, useState } from 'react';

export function useCrashDetection() {
  const [hasCrash, setHasCrash] = useState(false);

  useEffect(() => {
    setHasCrash(false);
  }, []);

  return hasCrash;
}
