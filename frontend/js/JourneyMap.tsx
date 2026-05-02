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

function formatDatetime(datetime: string) {
  return datetime.slice(0, 16).replace("T", " ");
}

function Sidebar({
  journey,
  loading,
  onMouseEnter,
  vehicle,
}: {
  journey: VehicleJourney;
  loading: boolean;
  onMouseEnter: (t: TripTime) => void;
  vehicle?: Vehicle;
}) {
  let className = "trip-timetable map-sidebar";
  if (loading) {
    className += " loading";
  }

  const trip: Trip | undefined = React.useMemo(() => {
    if (journey.times) {
      return { times: journey.times };
    }
  }, [journey.times]);

  let text = formatDatetime(journey.datetime);
  let reg: React.ReactNode = null;
  if (journey.vehicle) {
    text += ` ${journey.vehicle.fleet_code}`;
    reg = <span className="reg">{journey.vehicle.reg}</span>;
  } else if (journey.route_name) {
    text += ` ${journey.route_name}`;
    if (journey.destination) {
      text += ` to ${journey.destination}`;
    }
  }

  return (
    <div className={className}>
      <p>
        {text} {reg}
      </p>
      {trip ? (
        <TripTimetable
          onMouseEnter={onMouseEnter}
          trip={trip}
          vehicle={vehicle}
        />
      ) : null}
    </div>
  );
}

function JourneyVehicle({
  vehicleId,
  onVehicleMove,
  clickedVehicleMarker,
  setClickedVehicleMarker,
}: {
  vehicleId: number;
  onVehicleMove: (v: Vehicle) => void;
  clickedVehicleMarker: boolean;
  setClickedVehicleMarker: (b: boolean) => void;
}) {
  const [vehicle, setVehicle] = React.useState<Vehicle>();

  React.useEffect(() => {
    if (vehicle) {
      onVehicleMove(vehicle);
    }
  }, [vehicle, onVehicleMove]);

  React.useEffect(() => {
    if (!vehicleId) {
      return;
    }

    let timeout: number;
    let current = true;

    const loadVehicle = () => {
      fetch(`/vehicles.json?id=${vehicleId}`).then((response) => {
        recordSkew(response);
        response.json().then((data: Vehicle[]) => {
          if (current && data && data.length) {
            setVehicle(data[0]);
            timeout = window.setTimeout(loadVehicle, 12000); // 12 seconds
          }
        });
      });
    };

    loadVehicle();

    return () => {
      current = false;
      clearTimeout(timeout);
    };
  }, [vehicleId]);

  if (!vehicle) {
    return null;
  }

  return (
    <React.Fragment>
      <VehicleMarker selected={clickedVehicleMarker} vehicle={vehicle} />
      {clickedVehicleMarker ? (
        <VehiclePopup
          item={vehicle}
          onClose={() => setClickedVehicleMarker(false)}
        />
      ) : null}
    </React.Fragment>
  );
}

const isCurrent = (datetime: string): boolean => {
  return Date.now() - new Date(datetime).getTime() < 4 * 3600 * 1000;
};

export default function JourneyMap({
  journey,
  loading = false,
}: {
  journey?: VehicleJourney;
  loading: boolean;
}) {
  const [cursor, setCursor] = React.useState<string>();

  const hoveredLocation = React.useRef<number | null>(null);

  const onMouseEnter = React.useCallback((e: MapLayerMouseEvent) => {
    const vehicleId = getClickedVehicleMarkerId(e);
    if (vehicleId) {
      return;
    }

    if (e.features?.length) {
      setCursor("pointer");

      for (const feature of e.features) {
        if (feature.layer.id === "locations") {
          if (hoveredLocation.current) {
            e.target.setFeatureState(
              { source: "locations", id: hoveredLocation.current },
              { hover: false },
            );
          }
          e.target.setFeatureState(
            { source: "locations", id: feature.id },
            { hover: true },
          );
          hoveredLocation.current = feature.id as number;
          return;
        }
      }
    }
  }, []);

  const onMouseLeave = React.useCallback(() => {
    setCursor(undefined);
  }, []);

  const [clickedStopUrl, setClickedStop] = React.useState<string>();

  const [clickedVehicleMarker, setClickedVehicleMarker] =
    React.useState<boolean>(true);

  const [tailLocations, setTailLocations] = React.useState<
    VehicleJourneyLocation[]
  >([]);

  const [vehicle, setVehicle] = React.useState<Vehicle>();

  const handleVehicleMove = React.useCallback(
    (vehicle: Vehicle) => {
      if (
        !tailLocations.length ||
        tailLocations[tailLocations.length - 1].datetime < vehicle.datetime
      ) {
        setTailLocations(
          tailLocations.concat([
            {
              id: new Date(vehicle.datetime).getTime(),
              coordinates: vehicle.coordinates,
              datetime: vehicle.datetime,
              direction: vehicle.heading,
            },
          ]),
        );
        setVehicle(vehicle);
      }
    },
    [tailLocations],
  );

  const polylineLocations = React.useMemo(() => {
    if (journey?.time_aware_polyline) {
      return locationsFromPolyline(journey.time_aware_polyline);
    }
    return [];
  }, [journey?.time_aware_polyline]);

  const journeyIsCurrent = journey ? isCurrent(journey.datetime) : false;

  const handleMapClick = React.useCallback((e: MapLayerMouseEvent) => {
    const vehicleId = getClickedVehicleMarkerId(e);
    if (vehicleId) {
      setClickedVehicleMarker(true);
      setClickedStop(undefined);
      return;
    }

    setClickedVehicleMarker(false);

    if (e.features?.length) {
      for (const feature of e.features) {
        if (feature.layer.id === "stops") {
          setClickedStop(feature.properties.url);
          break;
        }
      }
    } else {
      setClickedStop(undefined);
    }
  }, []);

  const handleRowHover = React.useCallback((a: TripTime) => {
    if (a.stop.location && a.stop.atco_code) {
      setClickedStop(`/stops/${a.stop.atco_code}`);
    }
  }, []);

  const mapRef = React.useRef<MapGL | null>(null);

  const bounds = React.useMemo(() => {
    if (journey) {
      const _bounds = getBounds(journey.times, (item) => item.stop.location);
      return getBounds(polylineLocations, (item) => item.coordinates, _bounds);
    }
  }, [journey, polylineLocations]);

  const onMapInit = React.useCallback((map: MapGL) => {
    mapRef.current = map;
  }, []);

  React.useEffect(() => {
    if (bounds && mapRef.current) {
      mapRef.current.fitBounds(bounds, {
        padding: 50,
      });
    }
  }, [bounds]);

  if (!journey) {
    return <LoadingSorry />;
  }

  const clickedStop =
    clickedStopUrl && journey.times
      ? journey.times.find(
          (t) =>
            t.stop.atco_code && `/stops/${t.stop.atco_code}` === clickedStopUrl,
        )
      : undefined;

  let className = "journey-map has-sidebar";
  if (!journey.times) {
    className += " no-stops";
  }

  return (
    <React.Fragment>
      <div className={className}>
        {bounds ? (
          <BusTimesMap
            initialViewState={{
              bounds: bounds,
              fitBoundsOptions: {
                padding: 50,
              },
            }}
            cursor={cursor}
            onMouseEnter={onMouseEnter}
            onMouseMove={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onClick={handleMapClick}
            onMapInit={onMapInit}
            interactiveLayerIds={["stops", "locations"]}
          >
            {journey.times ? <Route times={journey.times} /> : null}

            {clickedStop?.stop.location ? (
              <StopPopup
                item={{
                  type: "Feature",
                  geometry: {
                    type: "Point",
                    coordinates: clickedStop.stop.location,
                  },
                  properties: {
                    url: `/stops/${clickedStop.stop.atco_code}`,
                    name: clickedStop.stop.name,
                    aimed_arrival_time: clickedStop.aimed_arrival_time,
                    aimed_departure_time: clickedStop.aimed_departure_time,
                    expected_arrival_time: clickedStop.expected_arrival_time,
                    expected_departure_time:
                      clickedStop.expected_departure_time,
                    actual_departure_time: clickedStop.actual_departure_time,
                  },
                }}
                onClose={() => setClickedStop(undefined)}
              />
            ) : null}

            {polylineLocations.length ? (
              <Locations
                locations={
                  journeyIsCurrent
                    ? polylineLocations.concat(tailLocations)
                    : polylineLocations
                }
              />
            ) : null}
            {journeyIsCurrent && journey.vehicle ? (
              <JourneyVehicle
                vehicleId={journey.vehicle.id}
                onVehicleMove={handleVehicleMove}
                clickedVehicleMarker={clickedVehicleMarker}
                setClickedVehicleMarker={setClickedVehicleMarker}
              />
            ) : null}
          </BusTimesMap>
        ) : null}
      </div>
      <Sidebar
        loading={loading}
        journey={journey}
        onMouseEnter={handleRowHover}
        vehicle={vehicle}
      />
    </React.Fragment>
  );
}
