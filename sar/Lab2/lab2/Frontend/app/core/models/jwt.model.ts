// Frontend/app/models/jwt.models.ts

// RFC 7519 standard claims
export interface JwtStandardClaims {
  iss?: string;           // Issuer
  sub?: string;           // Subject (usually user ID)
  aud?: string | string[]; // Audience
  exp?: number;           // Expiration time (Unix timestamp)
  nbf?: number;           // Not before
  iat?: number;           // Issued at
  jti?: string;           // JWT ID
}

export interface AppJwtClaims extends JwtStandardClaims {
  userId: string;
  username: string;
  role: 'admin' | 'user' | 'moderator';
}

// Alias para usar nos componentes
export type JwtPayload = AppJwtClaims;