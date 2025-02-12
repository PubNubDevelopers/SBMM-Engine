'use client';

import React, { Suspense } from "react";
import MatchResults from "./matchResults";

const MatchPage: React.FC = () => {
  return (
    <Suspense fallback={<div>Loading Match Results...</div>}>
      <MatchResults></MatchResults>
    </Suspense>
  );
};

export default MatchPage;