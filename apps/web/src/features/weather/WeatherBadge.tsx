import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Sun,
  type Icon,
} from '@phosphor-icons/react';

import { useWeather } from '@/features/events/api';

// WMO weather interpretation codes grouped into icons
export const weatherIcon = (code: number): Icon => {
  if (code === 0) return Sun;
  if (code <= 2) return CloudSun;
  if (code === 3) return Cloud;
  if (code === 45 || code === 48) return CloudFog;
  if (
    (code >= 71 && code <= 77) ||
    code === 85 ||
    code === 86 ||
    code === 66 ||
    code === 67
  ) {
    return CloudSnow;
  }
  if (code >= 95) return CloudLightning;
  return CloudRain;
};

function WeatherGlyph({ code }: { code: number }) {
  const props = {
    className: 'size-6',
    weight: 'duotone' as const,
    'aria-hidden': true,
  };
  const icon = weatherIcon(code);
  if (icon === Sun) return <Sun {...props} />;
  if (icon === CloudSun) return <CloudSun {...props} />;
  if (icon === Cloud) return <Cloud {...props} />;
  if (icon === CloudFog) return <CloudFog {...props} />;
  if (icon === CloudSnow) return <CloudSnow {...props} />;
  if (icon === CloudLightning) return <CloudLightning {...props} />;
  return <CloudRain {...props} />;
}

/** The weather at the start of the match; hidden when it is beyond the forecast window */
export function WeatherBadge({ eventId }: { eventId: string }) {
  const { data } = useWeather(eventId, true);
  const forecast = data?.forecast;
  if (!forecast) return null;

  const rain = forecast.precipitationProbability;

  return (
    <div
      className="grid shrink-0 justify-items-end gap-0.5 text-right"
      title={`Прогноз на начало матча: ${forecast.description}, ${Math.round(forecast.temperature)}°, ветер ${Math.round(forecast.windSpeed)} км/ч${data.location.name ? ` · ${data.location.name}` : ''}`}
    >
      <span className="flex items-center gap-1.5 font-mono text-lg tabular-nums">
        <WeatherGlyph code={forecast.weatherCode} />
        {Math.round(forecast.temperature)}°
      </span>
      <span className="text-xs text-pitch-muted">
        {forecast.description}
        {rain !== null && rain >= 20 && `, дождь ${rain}%`}
      </span>
    </div>
  );
}
