from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from google.protobuf import json_format
from google.transit import gtfs_realtime_pb2


from busstops.models import DataSource
from bustimes.models import Trip

from ...models import Vehicle, VehicleJourney, Operator
from .import_gtfsr_ie import Command as GTFSRCommand


class Command(GTFSRCommand):
    source_name = "RTCSNV"
    vehicle_code_scheme = "RTCSNV"

    def do_source(self):
        self.tzinfo = ZoneInfo("America/Los_Angeles")
        self.source, _ = DataSource.objects.get_or_create(name=self.source_name)
        self.url = "https://developer.rtcsnv.com/transitData/vehiclePositions.pb"

        self.operator = Operator.objects.get_or_create(
            noc="RTCSNV",
            defaults={
                "name": "Regional Transportation Commission of Southern Nevada",
                "url": "http://www.rtcsnv.com",
            },
        )[0]

        return self

    def get_items(self):
        response = self.session.get(self.url, timeout=10)
        response.raise_for_status()

        print(response.headers)

        feed = gtfs_realtime_pb2.FeedMessage()
        feed.ParseFromString(response.content)

        return feed.entity

    def get_vehicle(self, item):
        return Vehicle.objects.get_or_create(
            operator_id="RTCSNV",
            code=item.vehicle.vehicle.id,
            fleet_code=item.vehicle.vehicle.id,
        )

    def get_journey(self, item, vehicle):
        journey = VehicleJourney(code=item.vehicle.trip.trip_id)

        start_date = None
        if item.vehicle.trip.start_date:
            start_date = datetime.strptime(
                f"{item.vehicle.trip.start_date} 12:00:00",
                "%Y%m%d %H:%M:%S",
            )

            try:
                journey.datetime = datetime.strptime(
                    f"{item.vehicle.trip.start_date} {item.vehicle.trip.start_time}",
                    "%Y%m%d %H:%M:%S",
                ).replace(tzinfo=self.tzinfo)
                journey.date = journey.datetime.date()
            except ValueError:
                pass

        journey.route_name = item.vehicle.trip.route_id

        try:
            trip = Trip.objects.get(
                operator="RTCSNV", vehicle_journey_code=journey.code
            )
        except Trip.DoesNotExist:
            pass
        else:
            journey.trip = trip

            if start_date:
                journey.datetime = (
                    start_date.replace(tzinfo=self.tzinfo)
                    - timedelta(hours=12)
                    + trip.start
                )
                now = self.get_datetime(item)
                if journey.datetime - now > timedelta(hours=12):
                    # `start_date` is today but the trip's operational day is yesterday
                    journey.datetime -= timedelta(days=1)
                    journey.date -= timedelta(days=1)

            journey.service = trip.route.service

            journey.route_name = journey.service.line_name
            journey.destination = trip.headsign or ""

        vehicle.latest_journey_data = json_format.MessageToDict(item)

        return journey
