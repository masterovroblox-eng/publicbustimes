import React from "react";

import {
  Layer,
  type LayerProps,
  type MapLayerMouseEvent,
  Source,
} from "react-map-gl/maplibre";

import BusTimesMap, { ThemeContext } from "./Map";

import type { Map as MapGL } from "maplibre-gl";
import LoadingSorry from "./LoadingSorry";
import StopPopup from "./StopPopup";
import { Route } from "./TripMap";
import TripTimetable, { type Trip, type TripTime } from "./TripTimetable";
import VehicleMarker, {
  type Vehicle,
  getClickedVehicleMarkerId,
} from "./VehicleMarker";
import VehiclePopup from "./VehiclePopup";
import { recordSkew } from "./clockSkew";
import { decodeTimeAwarePolyline } from "./time-aware-polyline";
import { getBounds, getFont } from "./utils";

export type VehicleJourneyLocation = {
  id: number;
  coordinates: [number, number];
  direction?: number | null;
  datetime: string;
};

export type VehicleJourney = {
  id?: string | number;
  date: string;
  datetime: string;
  vehicle?: {
    id: number;
    slug: string;
    fleet_code: string;
    reg: string;
  };
  route_name?: string;
  destination?: string;
  trip_id?: number | null;
  times?: TripTime[];
  time_aware_polyline?: string;
  service?: {
    id: number;
    slug: string;
  };
  operator?: {
    noc: string;
    slug: string;
    name: string;
  };
};

function calcBearing(
  [lng1, lat1]: [number, number],
  [lng2, lat2]: [number, number],
): number {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function locationsFromPolyline(
  polyline: string,
): VehicleJourneyLocation[] {
  const points = decodeTimeAwarePolyline(polyline);
  return points.map(([lat, lng, ts], i) => {
    const coordinates: [number, number] = [lng, lat];
    let direction: number | undefined;
    const next = points[i + 1];
    const prev = points[i - 1];
    if (next) {
      direction = calcBearing(coordinates, [next[1], next[0]]);
    } else if (prev) {
      direction = calcBearing([prev[1], prev[0]], coordinates);
    }
    return {
      id: ts,
      coordinates,
      datetime: new Date(ts).toISOString(),
      direction,
    };
  });
}

export const Locations = React.memo(function Locations({
  locations,
}: {
  locations: VehicleJourneyLocation[];
}) {
  const theme = React.useContext(ThemeContext);
  const darkMode = theme.endsWith("_dark") || theme.endsWith("_satellite");

  const routeStyle: LayerProps = {
    type: "line",
    paint: {
      "line-color": darkMode ? "#eee" : "#666",
      "line-width": 2,
    },
  };

  const font = getFont(theme);

  const locationsStyle: LayerProps = {
    id: "locations",
    type: "symbol",
    layout: {
      "text-field": ["get", "time"],
      "text-size": 12,
      "text-font": font,

      "icon-rotate": ["+", 45, ["get", "heading"]],
      "icon-image": "history-arrow",
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
      "icon-anchor": "top-left",

      "text-allow-overlap": true,
    },
    paint: {
      "text-opacity": [
        "case",
        ["boolean", ["feature-state", "hover"], false],
        1,
        0,
      ],
      "text-color": darkMode ? "#fff" : "#333",
      "text-halo-color": darkMode ? "#333" : "#fff",
      "text-halo-width": 3,
    },
  };

  return (
    <React.Fragment>
      <Source
        type="geojson"
        data={{
          type: "LineString",
          coordinates: locations.map((l) => l.coordinates),
        }}
      >
        <Layer {...routeStyle} />
      </Source>

      <Source
        type="geojson"
        id="locations"
        data={{
          type: "FeatureCollection",
          features: locations.map((l) => {
            return {
              type: "Feature",
              id: l.id,
              geometry: {
                type: "Point",
                coordinates: l.coordinates,
              },
              properties: {
                heading: l.direction,
                time: l.datetime.slice(11, 19),
              },
            };
          }),
        }}
      >
        <Layer {...locationsStyle} />
      </Source>
    </React.Fragment>
  );
});
