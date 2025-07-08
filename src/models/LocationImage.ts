import { Table, Column, Model, PrimaryKey, AutoIncrement, DataType, AllowNull, BelongsTo, ForeignKey } from 'sequelize-typescript';
import { Location } from './Location';

@Table({ tableName: 'location_images', timestamps: true })
export class LocationImage extends Model<LocationImage> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  declare id: number;

  @AllowNull(false)
  @Column(DataType.TEXT)
  declare image: string;

  @ForeignKey(() => Location)
  @AllowNull(false)
  @Column(DataType.BIGINT)
  declare locationId: number;

  @BelongsTo(() => Location, 'locationId')
  declare location: Location;
}
