import { Table, Column, Model, PrimaryKey, AutoIncrement, DataType, Default, AllowNull, HasMany } from 'sequelize-typescript';
import { LocationImage } from './LocationImage';
import { LocationCoordinate } from './LocationCoordinate';
import { LocationCell } from './LocationCell';

@Table({ tableName: 'locations', paranoid: true, timestamps: true })
export class Location extends Model<Location> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  declare id: number;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare name: string;

  @AllowNull(false)
  @Column(DataType.TEXT)
  declare description: string;

  @AllowNull(false)
  @Column(DataType.ENUM('storage', 'refill', 'branch', 'deliver'))
  declare type: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare city: string;

  @Default(false)
  @AllowNull(false)
  @Column(DataType.BOOLEAN)
  declare enabled: boolean;

  @HasMany(() => LocationImage, 'locationId')
  declare images: LocationImage[];

  @HasMany(() => LocationCoordinate, 'locationId')
  declare coordinates: LocationCoordinate[];

  @HasMany(() => LocationCell, 'locationId')
  declare cells: LocationCell[];
}
