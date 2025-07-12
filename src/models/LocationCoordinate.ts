import { Table, Column, Model, PrimaryKey, AutoIncrement, DataType, AllowNull, BelongsTo, ForeignKey } from 'sequelize-typescript';
import { Location } from './Location';

@Table({ tableName: 'location_coordinates', timestamps: true })
export class LocationCoordinate extends Model<LocationCoordinate> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  declare id: number;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare world: string;

  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare x: number;

  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare y: number;

  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare z: number;

  @ForeignKey(() => Location)
  @AllowNull(false)
  @Column(DataType.BIGINT)
  declare locationId: number;

  @BelongsTo(() => Location, 'locationId')
  declare location: Location;
}
